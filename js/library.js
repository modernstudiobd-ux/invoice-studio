// library.js — the multi-invoice "Saved invoices" (History) list: save/open/
// duplicate/delete named snapshots, kept separate from the undo/redo stack.

import { $, esc, uid } from "./dom.js";
import { state, serialize } from "./state.js";
import { moneyFor, today, plusDays } from "./format.js";
import { calc } from "./calc.js";
import { toast } from "./toast.js";
import { load } from "./invoiceData.js";
import { renderPreview } from "./preview.js";
import { renderItems } from "./items.js";
import { save } from "./persistence.js";
import { activateTab, setMobileView, closeHistoryPanel } from "./layout.js";

export const LIBRARY_KEY = "invoiceStudio.library.v1", CURRENT_ID_KEY = "invoiceStudio.currentId.v1";

export function loadLibrary() {
  try { const v = JSON.parse(localStorage.getItem(LIBRARY_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

export function saveLibrary(lib) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); }
  catch { toast("Could not save locally — your browser's storage may be full (try a smaller logo)."); }
}

export function getCurrentId() {
  return localStorage.getItem(CURRENT_ID_KEY) || "";
}

export function setCurrentId(id) {
  try { localStorage.setItem(CURRENT_ID_KEY, id); } catch {}
}

export function nextInvoiceNumber() {
  const pool = loadLibrary().map(e => e.invoiceNumber).concat([$("invoiceNumber") ? $("invoiceNumber").value : ""]);
  let best = null;
  pool.forEach(v => { const m = /^(.*?)(\d+)\s*$/.exec(String(v || "").trim()); if (m) { const n = parseInt(m[2], 10); if (!isNaN(n) && (!best || n > best.n)) best = { prefix: m[1], n, digits: m[2].length }; } });
  return best ? best.prefix + String(best.n + 1).padStart(best.digits, "0") : "INV-1001";
}

export function saveToHistory() {
  try {
    const snap = serialize();
    let id = getCurrentId();
    if (!id) { id = uid(); setCurrentId(id); }
    let lib = loadLibrary();
    const meta = { id, invoiceNumber: $("invoiceNumber").value || "Untitled", clientName: $("clientName").value || "", status: $("status").value, currency: $("currency").value, total: calc().total, updatedAt: Date.now(), snapshot: snap };
    const idx = lib.findIndex(x => x.id === id);
    if (idx >= 0) lib[idx] = meta; else lib.unshift(meta);
    saveLibrary(lib);
    renderHistory();
  } catch { toast("Could not save this invoice — your browser's storage may be full (try a smaller logo)."); }
}

export function renderHistory() {
  const root = $("historyList"), countEl = $("historyCount");
  if (!root) return;
  const lib = loadLibrary().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const curId = getCurrentId();
  if (countEl) countEl.textContent = lib.length ? lib.length + (lib.length === 1 ? " invoice saved" : " invoices saved") : "";
  if (!lib.length) { root.innerHTML = '<p class="hint">No saved invoices yet — click Save above to add this one.</p>'; return; }
  root.innerHTML = lib.map(e => `<div class="historycard${e.id === curId ? " current" : ""}" data-id="${esc(e.id)}">
   <div class="historytop"><div><strong>${esc(e.invoiceNumber || "Untitled")}</strong>${e.id === curId ? '<span class="tinybadge">Current</span>' : ""}</div><span class="historyamount">${esc(moneyFor(e.total, e.currency))}</span></div>
   <div class="historymeta"><span>${esc(e.clientName || "No client")} · ${esc(e.status || "Draft")}</span><span>${esc(new Date(e.updatedAt).toLocaleDateString())}</span></div>
   <div class="historyactions"><button class="btn small" data-act="open" type="button">Open</button><button class="btn small" data-act="rename" type="button">Rename</button><button class="btn small" data-act="duplicate" type="button">Duplicate</button><button class="btn small danger" data-act="delete" type="button">Delete</button></div>
 </div>`).join("");
  root.querySelectorAll(".historycard").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="open"]').onclick = () => openInvoiceById(id);
    card.querySelector('[data-act="rename"]').onclick = () => renameInvoiceById(id);
    card.querySelector('[data-act="duplicate"]').onclick = () => duplicateInvoiceById(id);
    card.querySelector('[data-act="delete"]').onclick = () => deleteInvoiceById(id);
  });
}

export function openInvoiceById(id) {
  const entry = loadLibrary().find(x => x.id === id);
  if (!entry) return;
  setCurrentId(id);
  load(entry.snapshot);
  renderHistory();
  const tabBtn = $("tabbtn-design");
  if (tabBtn) activateTab(tabBtn, false);
  setMobileView("edit");
  closeHistoryPanel();
  toast("Opened " + (entry.invoiceNumber || "invoice") + ".");
}

export function deleteInvoiceById(id) {
  const lib = loadLibrary(), entry = lib.find(x => x.id === id);
  if (!entry) return;
  if (!confirm(`Delete "${entry.invoiceNumber || "this invoice"}" from Saved Invoices? This can't be undone.`)) return;
  saveLibrary(lib.filter(x => x.id !== id));
  renderHistory();
  toast("Deleted from history.");
}

export function renameInvoiceById(id) {
  const lib = loadLibrary(), entry = lib.find(x => x.id === id);
  if (!entry) return;
  const name = prompt("Rename this saved invoice:", entry.invoiceNumber || "Untitled");
  if (name == null) return; // cancelled
  const trimmed = name.trim();
  if (!trimmed) return toast("Invoice name can't be empty.");
  entry.invoiceNumber = trimmed;
  entry.updatedAt = Date.now();
  if (entry.snapshot && entry.snapshot.fields) entry.snapshot.fields.invoiceNumber = trimmed;
  saveLibrary(lib);
  // If this is the invoice currently open on screen, reflect the new name immediately too.
  if (id === getCurrentId()) { $("invoiceNumber").value = trimmed; renderPreview(); save(); }
  renderHistory();
  toast("Renamed to " + trimmed + ".");
}

export function clearLibrary() {
  if (!loadLibrary().length) return toast("No saved invoices to clear.");
  if (!confirm("Delete ALL saved invoices? This can't be undone. (Your current on-screen draft is not affected.)")) return;
  saveLibrary([]);
  renderHistory();
  toast("Cleared all saved invoices.");
}

export function duplicateCurrentInvoice() {
  setCurrentId(uid());
  $("invoiceNumber").value = nextInvoiceNumber();
  $("invoiceDate").value = today();
  $("dueDate").value = plusDays(today(), 14);
  renderPreview(); save(); saveToHistory();
  toast("Duplicated as " + $("invoiceNumber").value + ".");
}

export function duplicateInvoiceById(id) {
  const entry = loadLibrary().find(x => x.id === id);
  if (!entry) return;
  load(entry.snapshot);
  duplicateCurrentInvoice();
  closeHistoryPanel();
}

export function newInvoice() {
  if (!confirm("Start a new invoice? This clears the client and items from your current draft (company info and design stay). Save first if you want to keep this draft in Saved Invoices.")) return;
  setCurrentId(uid());
  $("invoiceNumber").value = nextInvoiceNumber();
  $("status").value = "Draft";
  $("invoiceDate").value = today();
  $("dueDate").value = plusDays(today(), 14);
  $("reference").value = "";
  ["clientName", "clientContact", "clientTax", "clientAddress", "clientEmail"].forEach(id => $(id).value = "");
  $("discount").value = "0"; $("tax").value = "0"; $("shipping").value = "0";
  $("notes").value = "";
  state.items = [];
  renderItems(); renderPreview(); save();
  renderHistory();
  toast("New invoice started — " + $("invoiceNumber").value);
}
