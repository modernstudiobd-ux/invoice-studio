// importSheet.js — parses a dropped CSV/XLSX file into line items, guessing
// which spreadsheet column maps to which invoice column.

import { state } from "./state.js";
import { num } from "./format.js";
import { roleCol } from "./calc.js";

export function parseCSV(t) {
  let rows = [], row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    let c = t[i], n = t[i + 1];
    if (c == '"' && q && n == '"') { cell += '"'; i++; }
    else if (c == '"') q = !q;
    else if (c == "," && !q) { row.push(cell); cell = ""; }
    else if ((c == "\n" || c == "\r") && !q) { if (c == "\r" && n == "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function mapRows(rows) {
  if (!rows.length) return [];
  let best = 0, score = -1;
  rows.slice(0, 30).forEach((r, i) => { let s = r.reduce((n, x) => n + (["sku", "description", "name", "item", "quantity", "qty", "net qty", "rate", "unit price", "amount", "royalty"].includes(norm(x)) ? 1 : 0), 0); if (s > score) { score = s; best = i; } });
  let h = rows[best].map(x => String(x ?? "").trim()), data = rows.slice(best + 1), aliases = { sku: ["sku", "item code", "product code", "code"], description: ["description", "name", "item", "product", "course name"], quantity: ["quantity", "qty", "net qty", "net quantity"], rate: ["rate", "unit price", "price", "unit rate"], amount: ["amount", "total", "royalty", "line total"] };
  return data.map(r => {
    let o = {}; h.forEach((x, i) => o[x] = r[i]); let item = {};
    state.columns.forEach(c => { let candidates = [norm(c.label), norm(c.key), ...(aliases[c.key] || [])], key = Object.keys(o).find(k => candidates.includes(norm(k))); if (key != null) item[c.key] = o[key]; });
    let q = roleCol("quantity"), rate = roleCol("rate"), amount = roleCol("amount");
    if (q && (!item[q.key] && item[q.key] !== 0)) item[q.key] = 1;
    if (rate && amount && (item[rate.key] == null || String(item[rate.key]).trim() === "") && num(item[amount.key])) item[rate.key] = num(item[amount.key]) / Math.max(1, num(item[q?.key] || 1));
    return Object.values(item).some(v => String(v ?? "").trim()) ? item : null;
  }).filter(Boolean);
}

export async function ensureXLSX() {
  if (window.XLSX) return;
  await new Promise((res, rej) => { let s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = res; s.onerror = () => rej(Error("Excel parser could not load. Use CSV or connect to the internet.")); document.head.appendChild(s); });
}
