// brandTemplates.js — "Save as template" for reusing the same invoice setup
// (company info, logo, design, colors, columns, section toggles, labels,
// and boilerplate payment/terms text) across multiple companies or personal
// brands, kept separate from the per-invoice "Saved invoices" History.
//
// A brand template intentionally excludes anything invoice-specific — the
// client, line items, invoice number/status/dates/reference, and the
// discount/tax/shipping/notes values — the same split newInvoice() already
// draws between "company profile and design" (kept) and "this invoice"
// (cleared). Applying a template only overwrites the brand-identity fields,
// so it's safe to use mid-invoice without losing whatever client/items work
// is already on screen.

import { $, esc, uid } from "./dom.js";
import { state, fields, defaultColumns, defaultSections, defaultLabels, LEGACY_LABEL_MAP } from "./state.js";
import { setAccent, applyAllOptionalColors } from "./accent.js";
import { renderColumns } from "./columns.js";
import { renderItems } from "./items.js";
import { renderToggles } from "./toggles.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";
import { toast } from "./toast.js";
import { closeTemplatesPanel } from "./layout.js";

export const BRAND_KEY = "invoiceStudio.brandTemplates.v1";

// Fields carried over as part of a company/brand's identity. Everything in
// `fields` (state.js) NOT listed here is invoice-specific and left alone —
// invoiceNumber, status, invoiceDate, dueDate, reference, all clientX
// fields, discount, tax, shipping, notes.
const BRAND_FIELD_IDS = fields.filter(id => ![
  "invoiceNumber", "status", "invoiceDate", "dueDate", "reference",
  "clientName", "clientContact", "clientTax", "clientAddress", "clientEmail",
  "discount", "tax", "shipping", "notes"
].includes(id));

export function loadBrandTemplates() {
  try { const v = JSON.parse(localStorage.getItem(BRAND_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

export function saveBrandTemplates(list) {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify(list)); }
  catch { toast("Could not save the template locally — your browser's storage may be full (try a smaller logo)."); }
}

// Snapshot just the brand-identity slice of the current on-screen invoice.
function serializeBrand() {
  let f = {};
  BRAND_FIELD_IDS.forEach(id => f[id] = $(id).value);
  return {
    fields: f,
    logo: state.logo,
    logoNatural: state.logoNatural,
    columns: state.columns,
    sections: state.sections
  };
}

export function saveCurrentAsTemplate() {
  const suggested = $("companyName").value.trim() || "Untitled brand";
  const name = prompt("Save as template — name this brand:", suggested);
  if (name == null) return; // cancelled
  const trimmed = name.trim();
  if (!trimmed) return toast("Template name can't be empty.");
  const list = loadBrandTemplates();
  const existing = list.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
  if (existing && !confirm(`A template named "${trimmed}" already exists. Overwrite it with the current design?`)) return;
  const snapshot = serializeBrand();
  if (existing) {
    existing.snapshot = snapshot;
    existing.updatedAt = Date.now();
  } else {
    list.unshift({ id: uid(), name: trimmed, updatedAt: Date.now(), snapshot });
  }
  saveBrandTemplates(list);
  renderBrandTemplates();
  toast(`Saved "${trimmed}" as a template.`);
}

// Applies a saved brand template onto the current on-screen invoice —
// company/logo/design/columns/sections/labels/payment+terms boilerplate —
// without touching the client, items, or this invoice's own number/status/
// dates/reference/discount/tax/shipping/notes.
export function applyBrandTemplate(id) {
  const entry = loadBrandTemplates().find(t => t.id === id);
  if (!entry) return;
  const d = entry.snapshot || {};
  BRAND_FIELD_IDS.forEach(fid => { if (d.fields && fid in d.fields && typeof d.fields[fid] === "string") $(fid).value = d.fields[fid]; });
  // Pre-3.15 templates kept labels in a separate top-level `labels` object.
  const legacyLabels = (d.labels && typeof d.labels === "object") ? d.labels : {};
  Object.entries(LEGACY_LABEL_MAP).forEach(([fid, legacyKey]) => {
    if (!BRAND_FIELD_IDS.includes(fid)) return;
    if (d.fields && typeof d.fields[fid] === "string") return;
    const legacyVal = typeof legacyLabels[legacyKey] === "string" ? legacyLabels[legacyKey] : defaultLabels()[legacyKey];
    $(fid).value = legacyVal || "";
  });
  state.logo = typeof d.logo === "string" ? d.logo : "";
  state.logoNatural = (d.logoNatural && typeof d.logoNatural.w === "number" && typeof d.logoNatural.h === "number") ? d.logoNatural : null;
  let cleanColumns = Array.isArray(d.columns) ? d.columns.filter(c => c && typeof c === "object" && typeof c.key === "string" && typeof c.label === "string").map(c => ({ id: typeof c.id === "string" ? c.id : uid(), key: c.key, label: c.label, type: ["text", "number", "currency", "percentage", "date"].includes(c.type) ? c.type : "text", width: Number.isFinite(Number(c.width)) ? Number(c.width) : 15, align: ["left", "right", "center"].includes(c.align) ? c.align : "left", visible: c.visible !== false, role: ["none", "quantity", "rate", "amount"].includes(c.role) ? c.role : "none" })) : [];
  state.columns = cleanColumns.length ? cleanColumns : defaultColumns();
  state.sections = { ...defaultSections(), ...(d.sections && typeof d.sections === "object" ? d.sections : {}) };
  setAccent($("accentHex").value);
  applyAllOptionalColors();
  renderColumns(); renderItems(); renderToggles(); renderPreview(); save();
  toast(`Loaded "${entry.name}" — client, items and invoice number are unchanged.`);
  closeTemplatesPanel();
}

export function renameBrandTemplate(id) {
  const list = loadBrandTemplates(), entry = list.find(t => t.id === id);
  if (!entry) return;
  const name = prompt("Rename this template:", entry.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) return toast("Template name can't be empty.");
  entry.name = trimmed;
  entry.updatedAt = Date.now();
  saveBrandTemplates(list);
  renderBrandTemplates();
  toast("Renamed to " + trimmed + ".");
}

export function deleteBrandTemplate(id) {
  const list = loadBrandTemplates(), entry = list.find(t => t.id === id);
  if (!entry) return;
  if (!confirm(`Delete the "${entry.name}" template? This can't be undone.`)) return;
  saveBrandTemplates(list.filter(t => t.id !== id));
  renderBrandTemplates();
  toast("Deleted template.");
}

export function clearBrandTemplates() {
  if (!loadBrandTemplates().length) return toast("No templates to clear.");
  if (!confirm("Delete ALL brand templates? This can't be undone. (Your current on-screen invoice is not affected.)")) return;
  saveBrandTemplates([]);
  renderBrandTemplates();
  toast("Cleared all templates.");
}

export function renderBrandTemplates() {
  const root = $("templatesList"), countEl = $("templatesCount");
  if (!root) return;
  const list = loadBrandTemplates().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  if (countEl) countEl.textContent = list.length ? list.length + (list.length === 1 ? " template saved" : " templates saved") : "";
  if (!list.length) { root.innerHTML = '<p class="hint">No templates yet — save your current company info, logo and design above, then reuse it for the next brand.</p>'; return; }
  root.innerHTML = list.map(e => `<div class="historycard" data-id="${esc(e.id)}">
   <div class="historytop"><div><strong>${esc(e.name)}</strong></div></div>
   <div class="historymeta"><span>${esc((e.snapshot && e.snapshot.fields && e.snapshot.fields.companyName) || "No company name")}</span><span>${esc(new Date(e.updatedAt).toLocaleDateString())}</span></div>
   <div class="historyactions"><button class="btn small" data-act="apply" type="button">Load</button><button class="btn small" data-act="rename" type="button">Rename</button><button class="btn small danger" data-act="delete" type="button">Delete</button></div>
 </div>`).join("");
  root.querySelectorAll(".historycard").forEach(card => {
    const id = card.dataset.id;
    card.querySelector('[data-act="apply"]').onclick = () => applyBrandTemplate(id);
    card.querySelector('[data-act="rename"]').onclick = () => renameBrandTemplate(id);
    card.querySelector('[data-act="delete"]').onclick = () => deleteBrandTemplate(id);
  });
}
