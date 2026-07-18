import { initTheme } from "./theme.js";
import {
  renderCategorySections,
  apiFetch,
  getStoredApiKey,
  setStoredApiKey,
} from "./services-ui.js";

initTheme();

const ZONE = "dev.home.arpa";

function showMsg(el, text, ok) {
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("is-ok", ok);
  el.classList.toggle("is-err", !ok);
}

async function refreshList() {
  const meta = document.getElementById("meta");
  const groupsEl = document.getElementById("groups");
  const empty = document.getElementById("empty");
  groupsEl.innerHTML = "";
  empty.hidden = true;

  const list = await fetch(
    `/api/services?zone=${encodeURIComponent(ZONE)}`,
  ).then((r) => r.json());
  const services = list.services || [];
  meta.textContent = `${services.length} in ${ZONE}`;

  if (!services.length) {
    empty.hidden = false;
    return;
  }
  renderCategorySections(services, groupsEl);
}

async function main() {
  const form = document.getElementById("dev-form");
  const apiKeyInput = document.getElementById("apiKey");
  const formMsg = document.getElementById("form-msg");
  apiKeyInput.value = getStoredApiKey();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const apiKey = String(fd.get("apiKey") || "").trim();
    setStoredApiKey(apiKey);

    const portRaw = String(fd.get("port") || "").trim();
    const body = {
      name: String(fd.get("name") || "").trim(),
      zone: ZONE,
      ip: String(fd.get("ip") || "").trim(),
      title: String(fd.get("title") || "").trim() || undefined,
      description: String(fd.get("description") || "").trim() || undefined,
      group: String(fd.get("group") || "").trim() || "Development",
      proxy: fd.get("proxy") === "on",
    };
    if (portRaw) body.port = Number(portRaw);
    if (body.proxy && !body.port) {
      showMsg(formMsg, "Port is required when proxy is enabled (Caddy needs a backend port).", false);
      return;
    }

    try {
      const result = await apiFetch("/api/services", {
        method: "POST",
        body,
        apiKey,
      });
      showMsg(
        formMsg,
        result.created
          ? `Created ${result.service.hostname}`
          : `Updated ${result.service.hostname}`,
        true,
      );
      await refreshList();
    } catch (err) {
      showMsg(formMsg, String(err.message || err), false);
    }
  });

  try {
    await refreshList();
  } catch (err) {
    document.getElementById("meta").textContent = "Failed to load";
    document.getElementById("empty").hidden = false;
    document.getElementById("empty").textContent = String(err);
  }
}

main();
