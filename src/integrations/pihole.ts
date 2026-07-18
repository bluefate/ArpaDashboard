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
    const getRes = await fetch(`${config.piholeUrl}/api/config/dns/hosts`, {
      headers: { sid: session.sid },
    });
    if (!getRes.ok) {
      throw new Error(`Failed to read dns.hosts (${getRes.status})`);
    }

    const current = (await getRes.json()) as {
      config?: { dns?: { hosts?: string[] } };
    };
    const hosts = [...(current.config?.dns?.hosts ?? [])];
    const filtered = hosts.filter((line) => {
      const parts = line.trim().split(/\s+/);
      return parts[1]?.toLowerCase() !== service.hostname.toLowerCase();
    });

    if (action === "upsert") {
      filtered.push(`${service.dns_ip} ${service.hostname}`);
    }

    const putRes = await fetch(`${config.piholeUrl}/api/config/dns/hosts`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        sid: session.sid,
      },
      body: JSON.stringify({ config: { dns: { hosts: filtered } } }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`Failed to write dns.hosts (${putRes.status}): ${text}`);
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
