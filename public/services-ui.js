import { escapeHtml } from "./status.js";

export const API_KEY_STORAGE = "arpa-api-key";

export function zoneKind(zone) {
  if (zone.startsWith("dev.")) return "dev";
  if (zone.startsWith("test.")) return "test";
  return "home";
}

/** Category (= service.group). Paused sorts last. */
export function groupServices(services) {
  const map = new Map();
  for (const s of services) {
    const key = s.group?.trim() || "Services";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === "Paused" && b !== "Paused") return 1;
    if (b === "Paused" && a !== "Paused") return -1;
    return a.localeCompare(b);
  });
}

export function accentFor(service) {
  const name = (service.name || "").toLowerCase();
  const map = {
    akaunting: "dark",
    gitea: "green",
    "gitea-ssh": "green",
    "registry-ui": "teal",
    registry: "purple",
    pihole: "pink",
  };
  if (map[name]) return map[name];
  const group = (service.group || "").toLowerCase();
  if (group.includes("business")) return "dark";
  if (group.includes("server")) return "blue";
  if (group.includes("paused")) return "dark";
  return "purple";
}

export function card(service) {
  const kind = zoneKind(service.zone);
  const paused = service.paused ? " is-paused" : "";
  const accent = service.accent || accentFor(service);
  const proxyChip = service.proxy
    ? `<span class="chip chip-proxy">proxy</span>`
    : `<span class="chip chip-direct">direct</span>`;
  const zoneChip = `<span class="chip chip-zone">${escapeHtml(service.zone)}</span>`;
  const kindChip =
    kind === "home" ? "" : `<span class="chip chip-dev">${kind}</span>`;

  return `
    <a class="card card-${accent}${paused}" href="${service.href}" ${service.paused ? 'aria-disabled="true"' : ""}>
      <p class="card-title">${escapeHtml(service.title || service.name)}</p>
      <p class="card-desc">${escapeHtml(service.description || service.hostname)}</p>
      <p class="card-host">${escapeHtml(service.hostname)}</p>
      <p class="card-ip">${escapeHtml(service.ip)}${service.port ? `:${service.port}` : ""}</p>
      <div class="chips">${proxyChip}${zoneChip}${kindChip}${(service.tags || [])
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join("")}</div>
    </a>
  `;
}

export function renderCategorySections(services, groupsEl) {
  const groups = groupServices(services);
  groupsEl.innerHTML = groups
    .map(
      ([name, items]) => `
      <section class="group">
        <div class="group-head">
          <h2>${escapeHtml(name)}</h2>
          <p>${items.length} endpoint${items.length === 1 ? "" : "s"}</p>
        </div>
        <div class="card-grid">
          ${items.map(card).join("")}
        </div>
      </section>`,
    )
    .join("");
}

export function getStoredApiKey() {
  return sessionStorage.getItem(API_KEY_STORAGE) || "";
}

export function setStoredApiKey(key) {
  if (key) sessionStorage.setItem(API_KEY_STORAGE, key);
  else sessionStorage.removeItem(API_KEY_STORAGE);
}

export async function apiFetch(path, { method = "GET", body, apiKey } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const key = apiKey ?? getStoredApiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const SUGGESTED_CATEGORIES = [
  "Business",
  "Applications",
  "Servers",
  "Development",
  "Paused",
];
