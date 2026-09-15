// main.js — composition root. Imports every module, wires the event
// listeners that don't already live in a feature module, and boots the app.
// Loaded as <script type="module" src="js/main.js"> — no bundler needed,
// the browser resolves all the import statements natively.

import { $, uid } from "./dom.js";
import { APP_VERSION, BUILD_DATE, BUILD_STRING } from "./version.js";
import { state, fields, KEY, DEFAULT_ACCENT, serialize } from "./state.js";
import { today, plusDays, num } from "./format.js";
import { toast } from "./toast.js";
import { setAccent, applyOptionalColor, clearOptionalColor, applyAllOptionalColors } from "./accent.js";
import { renderPreview, fitInvoiceCanvas, refreshItemRowAndTotals } from "./preview.js";
import { initColumnCanvas } from "./columnCanvas.js";
import { addItem } from "./items.js";
import { renderToggles } from "./toggles.js";
import { save, undo, redo, pushEditHistory, updateUndoRedoButtons } from "./persistence.js";
import { load } from "./invoiceData.js";
import { LIBRARY_KEY, CURRENT_ID_KEY, getCurrentId, setCurrentId, saveToHistory, renderHistory, duplicateCurrentInvoice, newInvoice, clearLibrary } from "./library.js";
import { BRAND_KEY, saveCurrentAsTemplate, renderBrandTemplates, clearBrandTemplates } from "./brandTemplates.js";
import { parseCSV, mapRows, ensureXLSX } from "./importSheet.js";
import { printInvoice } from "./print.js";
import { initInstallPrompt, registerServiceWorker } from "./install.js";
import { naturalLogoHeight, handleLogoFile, removeLogo } from "./logo.js";
import { initSettings, getDefaultPaperSize } from "./settings.js";
// layout.js self-wires its own listeners on import (sidebar resize, mobile view switch, floating panels, etc.)
import "./layout.js";

/* --- Form field bindings: any change to a tracked field re-renders +
   autosaves. This also covers the document-label fields living directly on
   the invoice (labelTitle, labelBillTo, labelBalance, labelNote,
   labelPayment, labelTerms, labelInvoiceDate, labelDueDate,
   labelReference) — they're ordinary entries in `fields` (state.js) like
   everything else, so renaming "INVOICE" to "QUOTE" or "Bill to" to
   something else needs no special-case code here. --- */
const OPTIONAL_COLOR_IDS = ["totalColor", "headerColor", "headerTextColor", "invoiceColor"];
fields.forEach(id => {
  let e = $(id), ev = e.tagName === "SELECT" ? "change" : "input";
  e.addEventListener(ev, () => {
    if (id === "accent" || id === "accentHex") setAccent(e.value);
    else if (OPTIONAL_COLOR_IDS.some(base => id === base + "Hex")) applyOptionalColor(id.replace(/Hex$/, ""));
    renderPreview(); save();
  });
});

/* --- Company name (js/preview.js, css/invoice.css): a growing <textarea>
   now, not a single-line <input> (see .companyinfo in invoice.css), so a
   long name wraps onto a second line instead of being silently clipped.
   That's the one behavior a real multi-line <textarea> adds that a name
   field shouldn't have, though: pressing Enter would insert a manual line
   break into the saved company name. Suppressing just Enter (Shift+Enter
   included, so there's no "soft break" escape hatch either) keeps it
   reading and behaving like a single logical name field that happens to
   wrap on its own — autoGrow() (preview.js) still grows/shrinks its height
   automatically as the person types or deletes, exactly like the Address
   field already does. --- */
$("companyName").addEventListener("keydown", e => { if (e.key === "Enter") e.preventDefault(); });

/* --- Optional color swatches (Total due / Header / Invoice area / Footer):
   picking a swatch color writes into its paired HEX field (the actual
   persisted value) and applies it; the ✕ button clears the override so the
   template's own default takes over again. --- */
OPTIONAL_COLOR_IDS.forEach(id => {
  $(id).addEventListener("input", () => { $(id + "Hex").value = $(id).value; applyOptionalColor(id); renderPreview(); save(); });
  $(id + "Clear").onclick = () => { clearOptionalColor(id); renderPreview(); save(); };
});

/* --- Items quick actions --- */
$("clearItemsBtn").onclick = () => { if (confirm("Remove all line items?")) { state.items = []; renderPreview(); save(); } };

/* --- Table columns: all add/remove/rename/reorder/resize/show-hide/
   settings controls live directly on the invoice canvas table (its header
   row + the trailing "+" cell) — see js/columnCanvas.js, which wires every
   delegated header interaction. --- */
initColumnCanvas();

// Inline item editing directly on the invoice canvas table (see preview.js):
// the "+ Add item" button (empty-state and trailing "add another" row),
// each row's "×" remove button, and every editable cell's <input>. All
// delegated on document — never bound per-element — since preview.js
// rebuilds #pItems' innerHTML on every full render, which would otherwise
// silently drop a directly-bound listener (or, worse for the input case,
// destroy the very element the person just attached a listener to) the
// next time the table redraws.
document.addEventListener("click", e => {
  if (e.target.closest(".add-item-btn")) { addItem(); return; }
  const removeBtn = e.target.closest(".item-remove-btn");
  if (removeBtn) {
    const idx = Number(removeBtn.dataset.idx);
    if (Number.isInteger(idx) && state.items[idx] !== undefined) {
      state.items.splice(idx, 1);
      renderPreview(); save();
    }
  }
});
// Typing into a canvas item cell only patches that item's data + the
// derived Amount cell/totals in place (refreshItemRowAndTotals) instead of
// calling the full renderPreview() every other canvas field triggers —
// renderPreview() would rebuild #pItems from scratch on every keystroke,
// yanking focus and the caret out of the input the person is actively
// typing in.
document.addEventListener("input", e => {
  const el = e.target.closest(".item-cell-input");
  if (!el) return;
  const idx = Number(el.dataset.idx);
  const item = state.items[idx];
  if (!item) return;
  const col = state.columns.find(c => c.key === el.dataset.key);
  item[el.dataset.key] = col && ["number", "currency", "percentage"].includes(col.type) ? num(el.value) : el.value;
  refreshItemRowAndTotals(idx);
  save();
});

/* --- Logo upload + settings panel --- */
$("logoFile").onchange = e => { const f = e.target.files && e.target.files[0]; if (f) handleLogoFile(f, e.target); };
$("removeLogoBtn").onclick = () => removeLogo();
$("resetLogoSizeBtn").onclick = () => { $("logoHeight").value = naturalLogoHeight(); renderPreview(); save(); toast(state.logoNatural ? "Logo reset to its original size." : "Logo size reset to default."); };
// The Size number field is a second, precise way to set the same
// #logoHeight value the slider drives — never an independent width, so the
// logo's proportions (enforced by object-fit:contain in invoice.css) can
// never be distorted by resizing. Re-dispatching a real "input" event on
// #logoHeight (rather than duplicating its logic here) lets it go through
// the exact same generic `fields` binding every other tracked field
// already uses (see the fields.forEach block near the top of this file).
{
  const logoHeightNumberEl = $("logoHeightValue"), logoHeightRangeEl = $("logoHeight");
  const commitLogoHeightNumber = () => {
    const clamped = Math.max(24, Math.min(160, num(logoHeightNumberEl.value) || naturalLogoHeight()));
    logoHeightNumberEl.value = clamped;
    if (String(clamped) !== logoHeightRangeEl.value) {
      logoHeightRangeEl.value = clamped;
      logoHeightRangeEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  logoHeightNumberEl.addEventListener("input", commitLogoHeightNumber);
  logoHeightNumberEl.addEventListener("blur", commitLogoHeightNumber);
}
// Position segmented control (Auto/Left/Above) — writes into the real,
// still-authoritative #logoPosition <select> (kept off-screen so
// state.js/preview.js/serialize() need no changes) and dispatches a real
// "change" event so it flows through the same generic `fields` binding as
// every other tracked field.
{
  const logoPositionSelectEl = $("logoPosition");
  document.querySelectorAll(".logo-position-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (logoPositionSelectEl.value === btn.dataset.pos) return;
      logoPositionSelectEl.value = btn.dataset.pos;
      logoPositionSelectEl.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}
$("resetColorBtn").onclick = () => { setAccent(DEFAULT_ACCENT); OPTIONAL_COLOR_IDS.forEach(clearOptionalColor); renderPreview(); save(); toast("Colors reset."); };

/* --- Print / JSON export-import / reset --- */
$("printBtn").onclick = () => {
  const filename = ($("invoiceNumber").value || "invoice").trim().replace(/[\\/:*?"<>|]+/g, "-");
  printInvoice(filename);
};
function download(name, text) { let b = new Blob([text], { type: "application/json" }), u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 500); }
$("exportBtn").onclick = () => download(($("invoiceNumber").value || "invoice") + ".json", JSON.stringify(serialize(), null, 2));
$("importBtn").onclick = () => $("jsonFile").click();
$("jsonFile").onchange = async e => { try { load(JSON.parse(await e.target.files[0].text())); toast("Invoice imported."); } catch (err) { toast(err.message); } e.target.value = ""; };
$("resetBtn").onclick = () => { if (confirm("Reset the app and delete ALL locally saved invoices and templates (current draft + Saved Invoices + Brand Templates)? This cannot be undone.")) { localStorage.removeItem(KEY); localStorage.removeItem(LIBRARY_KEY); localStorage.removeItem(CURRENT_ID_KEY); localStorage.removeItem(BRAND_KEY); location.reload(); } };

/* --- Spreadsheet (CSV/XLSX) import --- */
$("importSheetBtn").onclick = () => $("sheetFile").click();
$("sheetFile").onchange = async e => {
  let f = e.target.files[0]; if (!f) return;
  try {
    let rows;
    if (f.name.toLowerCase().endsWith(".csv")) rows = parseCSV(await f.text());
    else { await ensureXLSX(); let wb = XLSX.read(await f.arrayBuffer(), { type: "array" }), ws = wb.Sheets[wb.SheetNames[0]]; rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }); }
    let items = mapRows(rows);
    if (!items.length) throw Error("No usable invoice rows were found.");
    state.items = items;
    renderPreview(); save();
    toast(items.length + " items imported.");
  } catch (err) { toast(err.message); }
  e.target.value = "";
};

/* --- Zoom --- */
$("zoomIn").onclick = () => { state.zoom = Math.min(1.3, state.zoom + .1); renderPreview(); save(); };
$("zoomOut").onclick = () => { state.zoom = Math.max(.6, state.zoom - .1); renderPreview(); save(); };

/* --- Initial defaults + first render --- */
// Settings > Default paper size only seeds this starting value — if a
// draft/invoice is restored just below (or one is opened/imported later),
// its own saved Page size always overrides this, exactly like every other
// field in `fields` (state.js). This never touches an invoice that
// already has a Page size of its own.
$("paperSize").value = getDefaultPaperSize();
$("invoiceDate").value = today();
$("dueDate").value = plusDays(today(), 14);
if (!$("logoHeight").value) $("logoHeight").value = "48";
setAccent(DEFAULT_ACCENT);
applyAllOptionalColors();
renderToggles(); renderPreview();

{
  const canvasWrapEl = document.querySelector(".canvaswrap");
  if (canvasWrapEl) {
    if (window.ResizeObserver) new ResizeObserver(() => fitInvoiceCanvas()).observe(canvasWrapEl);
    else window.addEventListener("resize", fitInvoiceCanvas);
    window.addEventListener("orientationchange", () => setTimeout(fitInvoiceCanvas, 200));
  }
}

/* --- Restore last autosaved draft, then set up History/undo state --- */
try { let raw = localStorage.getItem(KEY); if (raw) load(JSON.parse(raw)); } catch {}
if (!getCurrentId()) setCurrentId(uid());
pushEditHistory();
updateUndoRedoButtons();
renderHistory();
renderBrandTemplates();

/* --- Save / Duplicate / New / Undo / Redo buttons --- */
// #saveStatus is a persistent "autosaved just now / Xm ago" indicator (like
// the reference UI's "Saved 2 min ago"), reflecting the continuous
// autosave-on-every-edit that already happens via save() in
// js/persistence.js — not a one-off flash tied to the "Save" button below.
// That button does something more specific (snapshotting to Saved
// Invoices, js/library.js), and keeps its own feedback via toast() instead,
// so the two forms of "saved" aren't conflated.
function formatSavedAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return "Saved just now";
  if (s < 60) return `Saved ${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `Saved ${m} min ago`;
  const h = Math.round(m / 60);
  return `Saved ${h}h ago`;
}
function refreshSaveStatus() {
  const el = $("saveStatus");
  if (!el) return;
  const ts = Number(localStorage.getItem("invoiceStudio.lastSavedAt"));
  if (!ts) { el.classList.remove("show"); return; }
  el.textContent = formatSavedAgo(ts);
  el.classList.add("show");
}
window.addEventListener("invoicestudio:autosaved", refreshSaveStatus);
refreshSaveStatus();
setInterval(refreshSaveStatus, 15000);

$("saveInvoiceBtn").onclick = () => { saveToHistory(); toast("Saved to Saved Invoices."); };
$("duplicateInvoiceBtn").onclick = () => duplicateCurrentInvoice();
$("newInvoiceBtn").onclick = () => newInvoice();
$("clearHistoryBtn").onclick = () => clearLibrary();
$("saveTemplateBtn").onclick = () => saveCurrentAsTemplate();
$("clearTemplatesBtn").onclick = () => clearBrandTemplates();
$("undoBtn").onclick = () => undo(load);
$("redoBtn").onclick = () => redo(load);
document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(load); }
  else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(load); }
});

/* --- PWA install banner + service worker --- */
initInstallPrompt();
registerServiceWorker();

/* --- Settings panel (Default paper size / Default date format / Theme) -
   Date format changes need the Saved Invoices and Brand Templates lists
   (both render a date outside the invoice canvas) re-drawn immediately so
   the new format is visible without reopening either panel. --- */
initSettings(() => { renderHistory(); renderBrandTemplates(); });

/* --- Build/version string ---------------------------------------------
   Console-logged (type `BUILD_STRING` in DevTools > Console) and now also
   shown, compactly, in the left sidebar footer (#sidebarVersion) — single
   source of truth stays js/version.js, bumped by the maintainer on every
   delivered update. */
{
  window.APP_VERSION = APP_VERSION;
  window.BUILD_DATE = BUILD_DATE;
  window.BUILD_STRING = BUILD_STRING;
  console.log(`%cInvoGen - Invoice Generator ${BUILD_STRING}`, "color:#4f46e5;font-weight:bold;");
  const versionEl = $("sidebarVersion");
  if (versionEl) { versionEl.textContent = `v${APP_VERSION}`; versionEl.title = BUILD_STRING; }
}
