function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderIntegrationStatus(health, gridEl) {
  if (!gridEl) return;
  const items = health.integrations
    ? Object.values(health.integrations)
    : [
        {
          enabled: true,
          label: "Service registry",
          detail: "Always on",
        },
        {
          enabled: Boolean(health.pihole),
          label: "Pi-hole Local DNS",
          detail: health.pihole
            ? "Enabled"
            : "Not configured — set PIHOLE_URL and PIHOLE_PASSWORD",
        },
        {
          enabled: Boolean(health.caddySnippet),
          label: "Caddy snippet writer",
          detail: health.caddySnippet
            ? "Enabled"
            : "Not configured — set CADDY_SNIPPET_PATH or edit Caddy by hand",
        },
      ];

  gridEl.innerHTML = items
    .map((item) => {
      const state = item.enabled ? "on" : "off";
      const label = item.enabled ? "Automated" : "Manual / off";
      return `
        <div class="status-card status-${state}">
          <div class="status-card-top">
            <p class="status-label">${escapeHtml(item.label)}</p>
            <span class="status-pill">${label}</span>
          </div>
          <p class="status-detail">${escapeHtml(item.detail)}</p>
        </div>
      `;
    })
    .join("");
}

export { escapeHtml };
