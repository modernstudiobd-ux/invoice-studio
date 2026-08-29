// main.js — composition root. Imports every module, wires the event
// listeners that don't already live in a feature module, and boots the app.
// Loaded as <script type="module" src="js/main.js"> — no bundler needed,
// the browser resolves all the import statements natively.

import { $, uid } from "./dom.js";
import { state, fields, defaultColumns, KEY, DEFAULT_ACCENT, serialize } from "./state.js";
import { today, plusDays } from "./format.js";
import { toast } from "./toast.js";
import { setAccent, applyOptionalColor, clearOptionalColor, applyAllOptionalColors } from "./accent.js";
import { renderPreview, fitInvoiceCanvas } from "./preview.js";
import { renderColumns } from "./columns.js";
import { renderItems } from "./items.js";
import { renderToggles } from "./toggles.js";
import { save, undo, redo, pushEditHistory, updateUndoRedoButtons } from "./persistence.js";
import { load } from "./invoiceData.js";
import { LIBRARY_KEY, CURRENT_ID_KEY, getCurrentId, setCurrentId, saveToHistory, renderHistory, duplicateCurrentInvoice, newInvoice, clearLibrary } from "./library.js";
import { BRAND_KEY, saveCurrentAsTemplate, renderBrandTemplates, clearBrandTemplates } from "./brandTemplates.js";
import { parseCSV, mapRows, ensureXLSX } from "./importSheet.js";
import { printInvoice } from "./print.js";
import { initInstallPrompt, registerServiceWorker } from "./install.js";
import { naturalLogoHeight, handleLogoFile, removeLogo } from "./logo.js";
import { initInlineEdit } from "./inlineEdit.js";
// layout.js self-wires its own listeners on import (tabs, sidebar, mobile drawer, etc.)
import "./layout.js";

/* --- Form field bindings: any change to a tracked field re-renders + autosaves --- */
const OPTIONAL_COLOR_IDS = ["totalColor", "headerColor", "headerTextColor", "invoiceColor"];
fields.forEach(id => {
  let e = $(id), ev = e.tagName === "SELECT" ? "change" : "input";
  e.addEventListener(ev, () => {
    if (id === "accent" || id === "accentHex") setAccent(e.value);
    else if (OPTIONAL_COLOR_IDS.some(base => id === base + "Hex")) applyOptionalColor(id.replace(/Hex$/, ""));
    renderPreview(); save();
  });
});

/* --- Optional color swatches (Total due / Header / Invoice area / Footer):
   picking a swatch color writes into its paired HEX field (the actual
   persisted value) and applies it; the ✕ button clears the override so the
   template's own default takes over again. --- */
OPTIONAL_COLOR_IDS.forEach(id => {
  $(id).addEventListener("input", () => { $(id + "Hex").value = $(id).value; applyOptionalColor(id); renderPreview(); save(); });
  $(id + "Clear").onclick = () => { clearOptionalColor(id); renderPreview(); save(); };
});

/* --- Items / columns quick actions --- */
$("addItemBtn").onclick = () => { let item = {}; state.columns.forEach(c => item[c.key] = c.role === "quantity" ? 1 : ""); state.items.push(item); renderItems(); renderPreview(); save(); };
$("clearItemsBtn").onclick = () => { if (confirm("Remove all line items?")) { state.items = []; renderItems(); renderPreview(); save(); } };
$("addColumnBtn").onclick = () => { let i = state.columns.length + 1; state.columns.push({ id: uid(), key: "column_" + Date.now(), label: "Column " + i, type: "text", width: 15, align: "left", visible: true, role: "none" }); renderColumns(); renderItems(); renderPreview(); save(); };
$("restoreColumnsBtn").onclick = () => { if (confirm("Restore the default five columns?")) { state.columns = defaultColumns(); renderColumns(); renderItems(); renderPreview(); save(); } };

/* --- Logo upload --- */
$("logoFile").onchange = e => { const f = e.target.files && e.target.files[0]; if (f) handleLogoFile(f, e.target); };
$("removeLogoBtn").onclick = () => removeLogo();
$("resetLogoSizeBtn").onclick = () => { $("logoHeight").value = naturalLogoHeight(); renderPreview(); save(); toast(state.logoNatural ? "Logo reset to its original size." : "Logo size reset to default."); };
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
$("resetBtn").onclick = () => { if (confirm("Reset the app and delete ALL locally saved invoices and templates (current draft + History + Templates)? This cannot be undone.")) { localStorage.removeItem(KEY); localStorage.removeItem(LIBRARY_KEY); localStorage.removeItem(CURRENT_ID_KEY); localStorage.removeItem(BRAND_KEY); location.reload(); } };

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
    renderItems(); renderPreview(); save();
    toast(items.length + " items imported.");
  } catch (err) { toast(err.message); }
  e.target.value = "";
};

/* --- Zoom --- */
$("zoomIn").onclick = () => { state.zoom = Math.min(1.3, state.zoom + .1); renderPreview(); save(); };
$("zoomOut").onclick = () => { state.zoom = Math.max(.6, state.zoom - .1); renderPreview(); save(); };

/* --- Initial defaults + first render --- */
$("invoiceDate").value = today();
$("dueDate").value = plusDays(today(), 14);
if (!$("logoHeight").value) $("logoHeight").value = "48";
setAccent(DEFAULT_ACCENT);
applyAllOptionalColors();
renderColumns(); renderItems(); renderToggles(); renderPreview();
initInlineEdit();

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
$("saveInvoiceBtn").onclick = () => { saveToHistory(); toast("Saved to history."); };
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
