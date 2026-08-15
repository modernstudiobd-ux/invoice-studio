// items.js — the line-item editor cards in the Items tab.

import { $, esc } from "./dom.js";
import { state } from "./state.js";
import { num } from "./format.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

export function renderItems() {
  let root = $("itemsEditor"); root.innerHTML = ""; state.items.forEach((item, idx) => {
    let card = document.createElement("div"); card.className = "itemcard"; let editable = state.columns.filter(c => c.role !== "amount");
    card.innerHTML = `<div class="itemtop"><strong>Item ${idx + 1}</strong><button class="btn small danger" aria-label="Remove item ${idx + 1}">Remove</button></div><div class="itemgrid">${editable.map(c => { let fid = "item" + idx + "_" + c.id; return `<div class="field ${c.type === "text" && c.key === "description" ? "full" : ""}"><label for="${fid}">${esc(c.label)}</label>${c.type === "text" && c.key === "description" ? `<textarea id="${fid}" data-key="${esc(c.key)}">${esc(item[c.key] ?? "")}</textarea>` : `<input id="${fid}" data-key="${esc(c.key)}" type="${["number", "currency", "percentage"].includes(c.type) ? "number" : c.type === "date" ? "date" : "text"}" step="0.01" value="${esc(item[c.key] ?? "")}">`}</div>`; }).join("")}</div>`;
    card.querySelector("button").onclick = () => { state.items.splice(idx, 1); renderItems(); renderPreview(); save(); };
    card.querySelectorAll("[data-key]").forEach(e => e.oninput = () => { item[e.dataset.key] = ["number", "currency", "percentage"].includes(state.columns.find(c => c.key === e.dataset.key)?.type) ? num(e.value) : e.value; renderPreview(); save(); });
    root.appendChild(card);
  });
}
