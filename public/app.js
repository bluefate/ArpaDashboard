import { initTheme } from "./theme.js";
import { renderCategorySections } from "./services-ui.js";
import { renderIntegrationStatus } from "./status.js";

initTheme();

function pageZone() {
  return document.body.dataset.zone?.trim() || "";
}

async function main() {
  const meta = document.getElementById("meta");
  const groupsEl = document.getElementById("groups");
  const empty = document.getElementById("empty");
  const statusGrid = document.getElementById("status-grid");
  const zone = pageZone();

  try {
    const healthPromise = fetch("/api/health").then((r) => r.json());
    const listUrl = zone
      ? `/api/services?zone=${encodeURIComponent(zone)}`
      : "/api/services";
    const listPromise = fetch(listUrl).then((r) => r.json());
    const [health, list] = await Promise.all([healthPromise, listPromise]);
    const services = list.services || [];

    if (statusGrid) renderIntegrationStatus(health, statusGrid);

    const pi = health.integrations?.pihole?.enabled ?? health.pihole;
    const zoneLabel = zone || "all zones";
    meta.textContent = `${services.length} in ${zoneLabel} · Pi-hole ${pi ? "auto" : "manual"}`;

    if (!services.length) {
      empty.hidden = false;
      empty.innerHTML = zone
        ? `No services in <code>${zone}</code> yet.`
        : `No services yet. Use <a href="/dev.html">Dev</a> or <a href="/manage.html">Manage</a>, or the <a href="/api/docs">API</a>.`;
      return;
    }

    renderCategorySections(services, groupsEl, { zone: zone || undefined });
  } catch (err) {
    meta.textContent = "Failed to load services";
    empty.hidden = false;
    empty.textContent = String(err);
  }
}

main();
