// calc.js — line-item and invoice-total math.

import { $ } from "./dom.js";
import { state } from "./state.js";
import { num } from "./format.js";

export function roleCol(role) {
  return state.columns.find(c => c.role === role);
}

export function itemValue(item, col) {
  if (col.role === "amount") {
    let q = roleCol("quantity"), r = roleCol("rate");
    return q && r ? num(item[q.key]) * num(item[r.key]) : num(item[col.key]);
  }
  return item[col.key] ?? "";
}

export function calc() {
  let ac = roleCol("amount"),
    subtotal = state.items.reduce((s, i) => s + num(itemValue(i, ac || { role: "none", key: "amount" })), 0),
    dr = Math.max(0, Math.min(100, num($("discount").value))),
    disc = subtotal * dr / 100,
    taxable = subtotal - disc,
    tr = Math.max(0, Math.min(100, num($("tax").value))),
    tax = taxable * tr / 100,
    ship = Math.max(0, num($("shipping").value));
  return { subtotal, dr, disc, tr, tax, ship, total: taxable + tax + ship };
}
