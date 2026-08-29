// invoiceData.js — turns a serialized snapshot (from localStorage, a History
// entry, or an imported .json file) back into live app state + a full re-render.

import { $, uid } from "./dom.js";
import { state, fields, defaultColumns, defaultSections, defaultLabels, defaultOverrides } from "./state.js";
import { setAccent, applyAllOptionalColors } from "./accent.js";
import { renderColumns } from "./columns.js";
import { renderItems } from "./items.js";
import { renderToggles } from "./toggles.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

export function load(d) {
  if (!d || typeof d !== "object") throw Error("Invalid invoice file.");
  fields.forEach(id => { if (d.fields && id in d.fields && typeof d.fields[id] === "string") $(id).value = d.fields[id]; });
  state.logo = typeof d.logo === "string" ? d.logo : "";
  state.logoNatural = (d.logoNatural && typeof d.logoNatural.w === "number" && typeof d.logoNatural.h === "number") ? d.logoNatural : null;
  state.zoom = (typeof d.zoom === "number" && d.zoom >= 0.5 && d.zoom <= 1.5) ? d.zoom : 1;
  let cleanColumns = Array.isArray(d.columns) ? d.columns.filter(c => c && typeof c === "object" && typeof c.key === "string" && typeof c.label === "string").map(c => ({ id: typeof c.id === "string" ? c.id : uid(), key: c.key, label: c.label, type: ["text", "number", "currency", "percentage", "date"].includes(c.type) ? c.type : "text", width: Number.isFinite(Number(c.width)) ? Number(c.width) : 15, align: ["left", "right", "center"].includes(c.align) ? c.align : "left", visible: c.visible !== false, role: ["none", "quantity", "rate", "amount"].includes(c.role) ? c.role : "none" })) : [];
  state.columns = cleanColumns.length ? cleanColumns : defaultColumns();
  state.items = Array.isArray(d.items) ? d.items.filter(i => i && typeof i === "object") : [];
  state.sections = { ...defaultSections(), ...(d.sections && typeof d.sections === "object" ? d.sections : {}) };
  state.labels = { ...defaultLabels(), ...(d.labels && typeof d.labels === "object" ? d.labels : {}) };
  { let ov = defaultOverrides(), src = (d.overrides && typeof d.overrides === "object") ? d.overrides : {};
    Object.keys(ov).forEach(k => { if (typeof src[k] === "string") ov[k] = src[k]; });
    state.overrides = ov; }
  setAccent($("accentHex").value); applyAllOptionalColors(); renderColumns(); renderItems(); renderToggles(); renderPreview(); save();
}
