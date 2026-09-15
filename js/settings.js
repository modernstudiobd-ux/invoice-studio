// settings.js — app-wide preferences (Default Paper Size, Default Date
// Format, Theme), wired from the left-sidebar Settings panel. These are
// deliberately kept separate from the per-invoice Design panel controls
// (Page setup/Alignment/Template/Currency/Table Columns, all in state.js's
// `fields`) and from the invoice document itself:
//  - Default Paper Size only seeds the Page size control's starting value
//    the next time the app boots with no invoice of its own yet — it never
//    overwrites a Page size already chosen on an existing/loaded invoice
//    (see the call site in main.js).
//  - Default Date Format is used to render dates in app-level lists
//    (Saved Invoices, Brand Templates) that live outside the invoice
//    canvas — the invoice's own date fields are untouched, same as the
//    rest of the document/preview/print output.
//  - Theme restyles the app's own chrome (sidebars, header, floating
//    panels) via CSS variables on <html>; see the "Theme" block in
//    css/base.css for how the invoice canvas/toolbar is explicitly
//    shielded from it.
// Persisted to its own localStorage key so it survives independently of
// any single invoice, autosave draft, or Saved Invoices/Brand Templates
// library.

import { $ } from "./dom.js";
import { toast } from "./toast.js";

export const SETTINGS_KEY = "invoiceStudio.settings.v1";

export const DEFAULT_SETTINGS = { paperSize: "a4", dateFormat: "dmy", theme: "system" };

let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (raw && typeof raw === "object") {
      settings = {
        paperSize: raw.paperSize === "letter" ? "letter" : "a4",
        dateFormat: raw.dateFormat === "mdy" ? "mdy" : "dmy",
        theme: ["light", "dark", "system"].includes(raw.theme) ? raw.theme : "system"
      };
    }
  } catch { /* corrupt/blocked storage — fall back to defaults already set above */ }
}
loadSettings();

function persist() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch { toast("Could not save settings locally — your browser's storage may be full."); }
}

export function getSettings() { return { ...settings }; }
export function getDefaultPaperSize() { return settings.paperSize; }
export function getDateFormat() { return settings.dateFormat; }

// Plain numeric DD/MM/YYYY or MM/DD/YYYY, independent of the visitor's
// browser locale (unlike Intl/toLocaleDateString, which would silently
// ignore this setting on browsers whose locale disagrees with it).
function pad2(n) { return String(n).padStart(2, "0"); }
export function formatDateBySetting(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const day = pad2(d.getDate()), month = pad2(d.getMonth() + 1), year = d.getFullYear();
  return settings.dateFormat === "mdy" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

// Theme — applies data-theme to <html>, which css/base.css uses to retint
// the app chrome only. "System" follows the OS/browser preference live.
const systemDarkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
export function applyTheme() {
  const effective = settings.theme === "system" ? (systemDarkQuery && systemDarkQuery.matches ? "dark" : "light") : settings.theme;
  document.documentElement.setAttribute("data-theme", effective);
}
applyTheme();
if (systemDarkQuery) {
  const onSystemChange = () => { if (settings.theme === "system") applyTheme(); };
  if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener("change", onSystemChange);
  else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSystemChange); // older Safari
}

function syncControls() {
  const paperEl = $("settingPaperSize"), dateEl = $("settingDateFormat");
  if (paperEl) paperEl.value = settings.paperSize;
  if (dateEl) dateEl.value = settings.dateFormat;
  document.querySelectorAll(".theme-switch .theme-btn").forEach(btn => {
    const active = btn.dataset.theme === settings.theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

// Wires the Settings panel controls (index.html #settingsPanel). `onChange`
// is called after anything that should be reflected elsewhere right away
// (currently: date format, which main.js uses to re-render the Saved
// Invoices / Brand Templates lists).
export function initSettings(onChange) {
  const paperEl = $("settingPaperSize"), dateEl = $("settingDateFormat"), resetBtn = $("resetSettingsBtn");
  syncControls();
  if (paperEl) paperEl.addEventListener("change", () => {
    settings.paperSize = paperEl.value === "letter" ? "letter" : "a4";
    persist();
  });
  if (dateEl) dateEl.addEventListener("change", () => {
    settings.dateFormat = dateEl.value === "mdy" ? "mdy" : "dmy";
    persist();
    if (onChange) onChange();
  });
  document.querySelectorAll(".theme-switch .theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (settings.theme === btn.dataset.theme) return;
      settings.theme = btn.dataset.theme;
      persist(); applyTheme(); syncControls();
    });
  });
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (!confirm("Reset Settings to default — Default paper size: A4, Default date format: DD/MM/YYYY, Theme: System? Your invoices, Saved Invoices and Brand Templates are not affected.")) return;
    settings = { ...DEFAULT_SETTINGS };
    persist(); applyTheme(); syncControls();
    if (onChange) onChange();
    toast("Settings reset to default.");
  });
}
