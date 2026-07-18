import { escapeHtml, renderIntegrationStatus } from "./status.js";
import { initTheme } from "./theme.js";

initTheme();

function zoneKind(zone) {
  if (zone.startsWith("dev.")) return "dev";
  if (zone.startsWith("test.")) return "test";
  return "home";
}

function groupServices(services) {
  const map = new Map();
  for (const s of services) {
    const key = s.group?.trim() || "Services";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function card(service) {
  const kind = zoneKind(service.zone);
  const paused = service.paused ? " is-paused" : "";
  const accent = service.accent || accentFor(service);
  const proxyChip = service.proxy
    ? `<span class="chip chip-proxy">proxy</span>`
    : `<span class="chip chip-direct">direct</span>`;
  const zoneChip =
    kind === "home" ? "" : `<span class="chip chip-dev">${kind}</span>`;

  return `
    <a class="card card-${accent}${paused}" href="${service.href}" ${service.paused ? 'aria-disabled="true"' : ""}>
      <p class="card-title">${escapeHtml(service.title || service.name)}</p>
      <p class="card-desc">${escapeHtml(service.description || service.hostname)}</p>
      <p class="card-host">${escapeHtml(service.hostname)}</p>
      <p class="card-ip">${escapeHtml(service.ip)}${service.port ? `:${service.port}` : ""}</p>
      <div class="chips">${proxyChip}${zoneChip}${(service.tags || [])
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join("")}</div>
    </a>
  `;
}

function accentFor(service) {
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
  return "purple";
}

async function main() {
  const meta = document.getElementById("meta");
  const groupsEl = document.getElementById("groups");
  const empty = document.getElementById("empty");
  const statusGrid = document.getElementById("status-grid");

  try {
    const [healthRes, listRes] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/services"),
    ]);
    const health = await healthRes.json();
    const { services } = await listRes.json();

    renderIntegrationStatus(health, statusGrid);

    const pi = health.integrations?.pihole?.enabled ?? health.pihole;
    meta.textContent = `${services.length} service${services.length === 1 ? "" : "s"} · Pi-hole ${pi ? "auto" : "manual"}`;

    if (!services.length) {
      empty.hidden = false;
      return;
    }

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
  } catch (err) {
    meta.textContent = "Failed to load services";
    empty.hidden = false;
    empty.textContent = String(err);
  }
}

main();
