import { config, type ServiceRecord } from "../config.js";

export type IntegrationResult = {
  ok: boolean;
  skipped?: boolean;
  detail: string;
};

type PiholeSession = {
  sid: string;
  csrf?: string;
};

async function piholeLogin(): Promise<PiholeSession | null> {
  if (!config.piholeUrl || !config.piholePassword) return null;

  const res = await fetch(`${config.piholeUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: config.piholePassword }),
  });

  if (!res.ok) {
    throw new Error(`Pi-hole auth failed (${res.status})`);
  }

  const body = (await res.json()) as {
    session?: { sid?: string; csrf?: string };
  };
  const sid = body.session?.sid;
  if (!sid) throw new Error("Pi-hole auth response missing session sid");
  return { sid, csrf: body.session?.csrf };
}

async function piholeLogout(session: PiholeSession): Promise<void> {
  try {
    await fetch(`${config.piholeUrl}/api/auth`, {
      method: "DELETE",
      headers: { sid: session.sid },
    });
  } catch {
    // best-effort
  }
}

async function listHosts(session: PiholeSession): Promise<string[]> {
  const getRes = await fetch(`${config.piholeUrl}/api/config/dns/hosts`, {
    headers: { sid: session.sid },
  });
  if (!getRes.ok) {
    throw new Error(`Failed to read dns.hosts (${getRes.status})`);
  }
  const current = (await getRes.json()) as {
    config?: { dns?: { hosts?: string[] } };
  };
  return [...(current.config?.dns?.hosts ?? [])];
}

/** Pi-hole v6: PUT/DELETE `/api/config/dns/hosts/<ip>%20<hostname>` (not JSON body replace). */
async function putHost(session: PiholeSession, entry: string): Promise<void> {
  const res = await fetch(
    `${config.piholeUrl}/api/config/dns/hosts/${encodeURIComponent(entry)}`,
    { method: "PUT", headers: { sid: session.sid } },
  );
  if (!res.ok && res.status !== 201) {
    const text = await res.text();
    throw new Error(`Failed to add dns.hosts entry (${res.status}): ${text}`);
  }
}

async function deleteHost(session: PiholeSession, entry: string): Promise<void> {
  const res = await fetch(
    `${config.piholeUrl}/api/config/dns/hosts/${encodeURIComponent(entry)}`,
    { method: "DELETE", headers: { sid: session.sid } },
  );
  // 204 success; 404 already gone
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Failed to remove dns.hosts entry (${res.status}): ${text}`);
  }
}

function hostnameOf(entry: string): string | undefined {
  const parts = entry.trim().split(/\s+/);
  return parts[1]?.toLowerCase();
}

/**
 * Upserts a Local DNS A record via Pi-hole v6 config API.
 * When Pi-hole is not configured, returns skipped.
 */
export async function syncPiholeDns(
  service: ServiceRecord,
  action: "upsert" | "delete",
): Promise<IntegrationResult> {
  if (config.dryRunIntegrations) {
    return {
      ok: true,
      skipped: true,
      detail: `dry-run: would ${action} ${service.hostname} → ${service.dns_ip}`,
    };
  }

  if (!config.piholeUrl || !config.piholePassword) {
    return {
      ok: true,
      skipped: true,
      detail: "Pi-hole not configured (set PIHOLE_URL and PIHOLE_PASSWORD)",
    };
  }

  const session = await piholeLogin();
  if (!session) {
    return { ok: false, detail: "Pi-hole login failed" };
  }

  try {
    const hosts = await listHosts(session);
    const target = service.hostname.toLowerCase();
    const existing = hosts.filter((line) => hostnameOf(line) === target);

    for (const line of existing) {
      await deleteHost(session, line);
    }

    if (action === "upsert") {
      await putHost(session, `${service.dns_ip} ${service.hostname}`);
    }

    return {
      ok: true,
      detail:
        action === "upsert"
          ? `Pi-hole: ${service.hostname} → ${service.dns_ip}`
          : `Pi-hole: removed ${service.hostname}`,
    };
  } finally {
    await piholeLogout(session);
  }
}
