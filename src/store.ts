import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  config,
  hostnameFor,
  type ServiceInput,
  type ServicePatch,
  type ServiceRecord,
} from "./config.js";

type StoreFile = {
  version: 1;
  services: ServiceRecord[];
};

function emptyStore(): StoreFile {
  return { version: 1, services: [] };
}

async function ensureStore(): Promise<StoreFile> {
  const file = path.resolve(config.dataPath);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.services)) {
      throw new Error("Invalid store shape");
    }
    return { version: 1, services: parsed.services };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`Resetting service store (${String(err)})`);
    }
    const empty = emptyStore();
    await atomicWrite(file, empty);
    return empty;
  }
}

async function atomicWrite(file: string, data: StoreFile): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

function dnsIpFor(input: Pick<ServiceInput, "proxy" | "ip">): string {
  if (input.proxy) {
    if (!config.caddyIp) {
      throw new Error("CADDY_IP is required when proxy=true");
    }
    return config.caddyIp;
  }
  return input.ip;
}

function assertZone(zone: string): void {
  if (!config.allowedZones.includes(zone)) {
    throw new Error(
      `Zone "${zone}" is not allowed. Use one of: ${config.allowedZones.join(", ")}`,
    );
  }
}

function assertProxyPort(input: { proxy?: boolean; port?: number }): void {
  if (input.proxy !== false && input.port === undefined) {
    throw new Error("port is required when proxy=true");
  }
}

export async function listServices(): Promise<ServiceRecord[]> {
  const store = await ensureStore();
  return [...store.services].sort((a, b) =>
    a.hostname.localeCompare(b.hostname),
  );
}

export async function getService(id: string): Promise<ServiceRecord | null> {
  const store = await ensureStore();
  return store.services.find((s) => s.id === id) ?? null;
}

export async function upsertService(input: ServiceInput): Promise<{
  service: ServiceRecord;
  created: boolean;
}> {
  assertZone(input.zone);
  assertProxyPort(input);

  const store = await ensureStore();
  const hostname = hostnameFor(input.name, input.zone);
  const existing = store.services.find((s) => s.hostname === hostname);
  const now = new Date().toISOString();

  if (existing) {
    const updated: ServiceRecord = {
      ...existing,
      ...input,
      hostname,
      dns_ip: dnsIpFor(input),
      updated_at: now,
    };
    store.services = store.services.map((s) =>
      s.id === existing.id ? updated : s,
    );
    await atomicWrite(path.resolve(config.dataPath), store);
    return { service: updated, created: false };
  }

  const created: ServiceRecord = {
    ...input,
    id: randomUUID(),
    hostname,
    dns_ip: dnsIpFor(input),
    created_at: now,
    updated_at: now,
  };
  store.services.push(created);
  await atomicWrite(path.resolve(config.dataPath), store);
  return { service: created, created: true };
}

export async function patchService(
  id: string,
  patch: ServicePatch,
): Promise<ServiceRecord | null> {
  const store = await ensureStore();
  const existing = store.services.find((s) => s.id === id);
  if (!existing) return null;

  const merged: ServiceInput = {
    name: patch.name ?? existing.name,
    zone: patch.zone ?? existing.zone,
    ip: patch.ip ?? existing.ip,
    port: patch.port ?? existing.port,
    proxy: patch.proxy ?? existing.proxy,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    group: patch.group ?? existing.group,
    tags: patch.tags ?? existing.tags,
    url_path: patch.url_path ?? existing.url_path,
    protocol: patch.protocol ?? existing.protocol,
    paused: patch.paused ?? existing.paused,
    accent: patch.accent ?? existing.accent,
  };

  assertZone(merged.zone);
  assertProxyPort(merged);

  const hostname = hostnameFor(merged.name, merged.zone);
  const conflict = store.services.find(
    (s) => s.hostname === hostname && s.id !== id,
  );
  if (conflict) {
    throw new Error(`Hostname already registered: ${hostname}`);
  }

  const updated: ServiceRecord = {
    ...existing,
    ...merged,
    hostname,
    dns_ip: dnsIpFor(merged),
    updated_at: new Date().toISOString(),
  };

  store.services = store.services.map((s) => (s.id === id ? updated : s));
  await atomicWrite(path.resolve(config.dataPath), store);
  return updated;
}

export async function deleteService(id: string): Promise<ServiceRecord | null> {
  const store = await ensureStore();
  const existing = store.services.find((s) => s.id === id) ?? null;
  if (!existing) return null;
  store.services = store.services.filter((s) => s.id !== id);
  await atomicWrite(path.resolve(config.dataPath), store);
  return existing;
}
