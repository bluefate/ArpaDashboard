import { initTheme } from "./theme.js";
import { escapeHtml } from "./status.js";
import {
  apiFetch,
  getStoredApiKey,
  setStoredApiKey,
  SUGGESTED_CATEGORIES,
} from "./services-ui.js";

initTheme();

let services = [];
let zones = [];

function showMsg(el, text, ok) {
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("is-ok", !!ok);
  el.classList.toggle("is-err", !ok);
}

function categoryOptions(current) {
  const set = new Set(SUGGESTED_CATEGORIES);
  for (const s of services) {
    if (s.group?.trim()) set.add(s.group.trim());
  }
  if (current?.trim()) set.add(current.trim());
  return [...set].sort((a, b) => {
    if (a === "Paused" && b !== "Paused") return 1;
    if (b === "Paused" && a !== "Paused") return -1;
    return a.localeCompare(b);
  });
}

function fillDatalist() {
  const dl = document.getElementById("manage-categories");
  dl.innerHTML = categoryOptions()
    .map((c) => `<option value="${escapeHtml(c)}"></option>`)
    .join("");
}

function renderManageList() {
  const list = document.getElementById("manage-list");
  if (!services.length) {
    list.innerHTML = `<p class="empty">No services registered.</p>`;
    return;
  }

  list.innerHTML = services
    .map((s) => {
      const cats = categoryOptions(s.group);
      const opts = cats
        .map((c) => {
          const selected = (s.group || "Services") === c ? " selected" : "";
          return `<option value="${escapeHtml(c)}"${selected}>${escapeHtml(c)}</option>`;
        })
        .join("");
      return `
        <div class="manage-row" data-id="${escapeHtml(s.id)}">
          <div class="manage-info">
            <p class="manage-title">${escapeHtml(s.title || s.name)}</p>
            <p class="manage-host">${escapeHtml(s.hostname)} · ${escapeHtml(s.zone)}</p>
          </div>
          <label class="manage-cat">
            <span class="sr-only">Category</span>
            <select class="cat-select" data-id="${escapeHtml(s.id)}">
              ${opts}
              <option value="__custom__">Custom…</option>
            </select>
          </label>
        </div>`;
    })
    .join("");
}

async function loadServices() {
  const meta = document.getElementById("meta");
  const data = await fetch("/api/services").then((r) => r.json());
  services = data.services || [];
  meta.textContent = `${services.length} service${services.length === 1 ? "" : "s"}`;
  fillDatalist();
  renderManageList();
}

async function changeCategory(id, group) {
  const msg = document.getElementById("manage-msg");
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    showMsg(msg, "Save your API key first.", false);
    return;
  }
  const patch = {
    group,
    paused: group === "Paused",
  };
  try {
    await apiFetch(`/api/services/${id}`, {
      method: "PATCH",
      body: patch,
      apiKey,
    });
    showMsg(msg, `Moved to “${group}”.`, true);
    await loadServices();
  } catch (err) {
    showMsg(msg, String(err.message || err), false);
  }
}

async function main() {
  const keyInput = document.getElementById("apiKey");
  const keyForm = document.getElementById("key-form");
  const keyMsg = document.getElementById("key-msg");
  const clearBtn = document.getElementById("clear-key");
  const regForm = document.getElementById("reg-form");
  const regZone = document.getElementById("reg-zone");
  const regMsg = document.getElementById("reg-msg");
  const manageList = document.getElementById("manage-list");

  keyInput.value = getStoredApiKey();

  const health = await fetch("/api/health").then((r) => r.json());
  zones = health.zones || ["home.arpa", "dev.home.arpa"];
  regZone.innerHTML = zones
    .map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`)
    .join("");

  keyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setStoredApiKey(keyInput.value.trim());
    showMsg(keyMsg, "API key saved for this browser session.", true);
  });

  clearBtn.addEventListener("click", () => {
    setStoredApiKey("");
    keyInput.value = "";
    showMsg(keyMsg, "API key cleared.", true);
  });

  manageList.addEventListener("change", async (e) => {
    const sel = e.target.closest("select.cat-select");
    if (!sel) return;
    let group = sel.value;
    if (group === "__custom__") {
      const typed = window.prompt("Category name:");
      if (!typed?.trim()) {
        await loadServices();
        return;
      }
      group = typed.trim();
    }
    await changeCategory(sel.dataset.id, group);
  });

  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      showMsg(regMsg, "Save your API key first.", false);
      return;
    }
    const fd = new FormData(regForm);
    const portRaw = String(fd.get("port") || "").trim();
    const body = {
      name: String(fd.get("name") || "").trim(),
      zone: String(fd.get("zone") || "").trim(),
      ip: String(fd.get("ip") || "").trim(),
      title: String(fd.get("title") || "").trim() || undefined,
      group: String(fd.get("group") || "").trim() || undefined,
      proxy: fd.get("proxy") === "on",
      paused: fd.get("paused") === "on",
    };
    if (portRaw) body.port = Number(portRaw);
    try {
      const result = await apiFetch("/api/services", {
        method: "POST",
        body,
        apiKey,
      });
      showMsg(
        regMsg,
        result.created
          ? `Created ${result.service.hostname}`
          : `Updated ${result.service.hostname}`,
        true,
      );
      regForm.reset();
      regForm.proxy.checked = true;
      await loadServices();
    } catch (err) {
      showMsg(regMsg, String(err.message || err), false);
    }
  });

  try {
    await loadServices();
  } catch (err) {
    document.getElementById("meta").textContent = "Failed to load";
    document.getElementById("manage-list").textContent = String(err);
  }
}

main();
