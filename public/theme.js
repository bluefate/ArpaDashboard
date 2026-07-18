const STORAGE_KEY = "arpa-theme";

export function getTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    const isDark = next === "dark";
    btn.setAttribute("aria-pressed", String(isDark));
    btn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme",
    );
  }
}

export function initTheme() {
  applyTheme(getTheme());
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    applyTheme(getTheme() === "dark" ? "light" : "dark");
  });
}
