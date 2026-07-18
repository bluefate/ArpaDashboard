import { renderIntegrationStatus } from "./status.js";
import { initTheme } from "./theme.js";

initTheme();

async function main() {
  const meta = document.getElementById("meta");
  const statusGrid = document.getElementById("status-grid");

  try {
    const health = await (await fetch("/api/health")).json();
    renderIntegrationStatus(health, statusGrid);
    const pi = health.integrations?.pihole?.enabled ?? health.pihole;
    const caddy = health.integrations?.caddySnippet?.enabled ?? health.caddySnippet;
    meta.textContent = `Pi-hole ${pi ? "automated" : "manual"} · Caddy ${caddy ? "snippet on" : "manual"}`;
  } catch (err) {
    meta.textContent = "Could not load status";
    if (statusGrid) {
      statusGrid.innerHTML = `<p class="empty">${String(err)}</p>`;
    }
  }
}

main();
