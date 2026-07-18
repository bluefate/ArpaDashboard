import type { ServiceRecord } from "./config.js";

export type ReachabilityStatus = "up" | "down" | "skipped" | "paused";

export type ReachabilityResult = {
  id: string;
  hostname: string;
  status: ReachabilityStatus;
  detail: string;
  ms?: number;
};

const NON_HTTP_PORTS = new Set([22, 53, 25, 465, 587, 993, 995, 3306, 5432]);
const PROBE_TIMEOUT_MS = 2500;

/**
 * Best-effort HTTP probe of the service backend (ip:port).
 * Any HTTP response (including 4xx/5xx) counts as up — the process is listening.
 */
export async function probeService(
  service: ServiceRecord,
): Promise<ReachabilityResult> {
  const base = {
    id: service.id,
    hostname: service.hostname,
  };

  if (service.paused) {
    return { ...base, status: "paused", detail: "Paused" };
  }

  if (!service.port) {
    return {
      ...base,
      status: "skipped",
      detail: "No port configured — cannot probe",
    };
  }

  if (NON_HTTP_PORTS.has(service.port)) {
    return {
      ...base,
      status: "skipped",
      detail: `Port ${service.port} is not probed (non-HTTP)`,
    };
  }

  const path = service.url_path?.trim() || "/";
  const url = `http://${service.ip}:${service.port}${path.startsWith("/") ? path : `/${path}`}`;
  const started = Date.now();

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { Accept: "*/*" },
    });
    return {
      ...base,
      status: "up",
      detail: `HTTP ${res.status}`,
      ms: Date.now() - started,
    };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? "Timed out"
        : "Unreachable";
    return {
      ...base,
      status: "down",
      detail: reason,
      ms: Date.now() - started,
    };
  }
}

export async function probeServices(
  services: ServiceRecord[],
): Promise<ReachabilityResult[]> {
  return Promise.all(services.map((s) => probeService(s)));
}
