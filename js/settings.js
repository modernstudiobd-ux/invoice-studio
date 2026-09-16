// settings.js — app-wide preferences (Default Paper Size, Default Date
// Format, Theme), wired from the left-sidebar Settings panel.
//
// Default Paper Size is NOT a separate piece of state: it mirrors the
// exact same #paperSize field the Design panel's own "Page size" control
// already drives (state.js's PAPER_SIZES/currentPaper()/applyPaperSize(),
// serialized/autosaved as part of the invoice in state.js's `fields`).
// Changing it here just sets #paperSize's value and dispatches a real
// "change" event, so it flows through the exact same generic binding
// every other Design-panel field already uses (see the `fields.forEach`
// block in main.js): renderPreview() re-applies the page size to the live
// canvas/preview immediately, and save() persists it — print.js reads the
// same #paperSize field again at print/PDF time. That keeps this file
// from ever re-implementing page-size logic that already exists.
//
// Default Date Format instead persists its own small setting (there's no
// single existing "current date format" field to mirror), and format.js's
// dateFmt() — the app's one actual date-formatting function — reads it
// directly. Changing the setting here just triggers the normal re-render
// paths (renderPreview/renderHistory/renderBrandTemplates) so every date
// already going through dateFmt() picks up the new format immediately.
//
// Theme restyles the app's own chrome (sidebars, header, floating panels)
// via CSS variables on <html>; see the "Theme" block in css/base.css for
// how the invoice canvas/toolbar is explicitly shielded from it.
//
// Each preference gets its own localStorage key, matching how the rest of
// the app already persists small settings (see layout.js's
// invoiceStudio.rightSidebarWidth / invoiceStudio.designPanelOpen) rather
// than one combined JSON blob.

import { $ } from "./dom.js";
import { toast } from "./toast.js";

export const PAPER_SIZE_KEY = "invoiceStudio.defaultPaperSize";
export const DATE_FORMAT_KEY = "invoiceStudio.dateFormat";
export const THEME_KEY = "invoiceStudio.theme";

function safeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { toast("Could not save settings locally — your browser's storage may be full."); }
}

/* --- Default Paper Size --------------------------------------------- */
// Only read at boot, to seed #paperSize's starting value before any
// autosaved/loaded invoice (which always carries its own Page size) has a
// chance to override it — see the call site in main.js.
export function getDefaultPaperSize() {
  return safeGet(PAPER_SIZE_KEY, "a4") === "letter" ? "letter" : "a4";
}

/* --- Default Date Format ---------------------------------------------- */
export function getDateFormat() {
  return safeGet(DATE_FORMAT_KEY, "dmy") === "mdy" ? "mdy" : "dmy";
}
function setDateFormat(v) { safeSet(DATE_FORMAT_KEY, v === "mdy" ? "mdy" : "dmy"); }

/* --- Theme -------------------------------------------------------------
   "System" follows the OS/browser preference live. Applying it sets
   data-theme on <html>, which css/base.css uses to retint the app chrome
   only (see the "canvas shield" comment there). */
function getTheme() {
  const v = safeGet(THEME_KEY, "system");
  return ["light", "dark", "system"].includes(v) ? v : "system";
}
function setTheme(v) { safeSet(THEME_KEY, v); }

const systemDarkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
export function applyTheme() {
  const theme = getTheme();
  const effective = theme === "system" ? (systemDarkQuery && systemDarkQuery.matches ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", effective);
}
applyTheme();
if (systemDarkQuery) {
  const onSystemChange = () => { if (getTheme() === "system") applyTheme(); };
  if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener("change", onSystemChange);
  else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSystemChange); // older Safari
}

function syncThemeControls() {
  const theme = getTheme();
  document.querySelectorAll(".theme-switch .theme-btn").forEach(btn => {
    const active = btn.dataset.theme === theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

/* --- Wiring -------------------------------------------------------------
   `onDateFormatChange` is called after anything that should be reflected
   elsewhere right away: main.js passes a callback that re-renders the
   current invoice preview (for any "date"-type line-item columns) plus
   the Saved Invoices / Brand Templates lists — everywhere dateFmt() is
   used. --------------------------------------------------------------- */
export function initSettings(onDateFormatChange) {
  const paperEl = $("settingPaperSize"), dateEl = $("settingDateFormat"), resetBtn = $("resetSettingsBtn");
  const canvasPaperEl = $("paperSize");

  function applyPaperSizeChange(v) {
    v = v === "letter" ? "letter" : "a4";
    safeSet(PAPER_SIZE_KEY, v);
    if (canvasPaperEl && canvasPaperEl.value !== v) {
      canvasPaperEl.value = v;
      // Real change event — same pattern main.js already uses for the
      // logo position segmented control — so this goes through the exact
      // fields.forEach binding that renders + saves every other field.
      canvasPaperEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (paperEl && paperEl.value !== v) paperEl.value = v;
  }
  if (paperEl) {
    // Always mirrors whichever paper size is actually live on #paperSize
    // right now (a restored invoice's own saved size, or the seeded
    // default — see main.js), not a possibly-stale remembered value.
    paperEl.value = canvasPaperEl ? canvasPaperEl.value : getDefaultPaperSize();
    paperEl.addEventListener("change", () => applyPaperSizeChange(paperEl.value));
  }
  // Keep the Settings dropdown (and the remembered default) in sync when
  // Page size is instead changed directly on the Design panel.
  if (canvasPaperEl) canvasPaperEl.addEventListener("change", () => {
    safeSet(PAPER_SIZE_KEY, canvasPaperEl.value === "letter" ? "letter" : "a4");
    if (paperEl && paperEl.value !== canvasPaperEl.value) paperEl.value = canvasPaperEl.value;
  });

  if (dateEl) {
    dateEl.value = getDateFormat();
    dateEl.addEventListener("change", () => {
      setDateFormat(dateEl.value);
      if (onDateFormatChange) onDateFormatChange();
    });
  }

  syncThemeControls();
  document.querySelectorAll(".theme-switch .theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (getTheme() === btn.dataset.theme) return;
      setTheme(btn.dataset.theme);
      applyTheme(); syncThemeControls();
    });
  });

  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (!confirm("Reset Settings to default — Default paper size: A4, Default date format: DD/MM/YYYY, Theme: System? Your invoices, Saved Invoices and Brand Templates are not deleted.")) return;
    applyPaperSizeChange("a4");
    setDateFormat("dmy"); if (dateEl) dateEl.value = "dmy";
    setTheme("system"); applyTheme(); syncThemeControls();
    if (onDateFormatChange) onDateFormatChange();
    toast("Settings reset to default.");
  });
}
