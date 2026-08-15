// columns.js — the "Items table columns" editor in the Design tab (add/remove/
// reorder columns, change type/width/alignment/calculation role).

import { $, esc } from "./dom.js";
import { state } from "./state.js";
import { num, normalizeKey } from "./format.js";
import { toast } from "./toast.js";
import { renderPreview } from "./preview.js";
import { renderItems } from "./items.js";
import { save } from "./persistence.js";

export function renderColumns() {
  let root = $("columnEditor"); root.innerHTML = ""; state.columns.forEach((c, idx) => {
    let row = document.createElement("div"); row.className = "columnrow"; row.draggable = true;
    let uidStr = "col" + idx + "_" + c.id;
    row.innerHTML = `<div class="columnhead"><button class="btn icon reorder" data-dir="up" aria-label="Move column ${idx + 1} up" ${idx === 0 ? "disabled" : ""}>↑</button><button class="btn icon reorder" data-dir="down" aria-label="Move column ${idx + 1} down" ${idx === state.columns.length - 1 ? "disabled" : ""}>↓</button><span class="drag" aria-hidden="true">☰</span><strong>Column ${idx + 1}</strong><label class="tiny" for="${uidStr}-vis"><input id="${uidStr}-vis" class="vis" type="checkbox" ${c.visible ? "checked" : ""}> Show</label><button class="btn icon danger" aria-label="Remove column ${idx + 1}" title="Remove column">×</button></div><div class="colgrid"><div class="field"><label for="${uidStr}-label">Heading</label><input id="${uidStr}-label" class="labelinput" value="${esc(c.label)}"></div><div class="field"><label for="${uidStr}-type">Type</label><select id="${uidStr}-type" class="type"><option value="text">Text</option><option value="number">Number</option><option value="currency">Currency</option><option value="percentage">Percentage</option><option value="date">Date</option></select></div><div class="field"><label for="${uidStr}-width">Width %</label><input id="${uidStr}-width" class="width" type="number" min="5" max="80" value="${c.width}"></div><div class="field"><label for="${uidStr}-align">Alignment</label><select id="${uidStr}-align" class="align"><option value="left">Left</option><option value="right">Right</option><option value="center">Center</option></select></div><div class="field"><label for="${uidStr}-role">Calculation role</label><select id="${uidStr}-role" class="role"><option value="none">None</option><option value="quantity">Quantity</option><option value="rate">Rate</option><option value="amount">Amount</option></select></div></div>`;
    row.querySelector(".type").value = c.type; row.querySelector(".align").value = c.align; row.querySelector(".role").value = c.role;
    let sync = () => { let old = c.key, newLabel = row.querySelector(".labelinput").value.trim() || "Column"; c.label = newLabel; c.type = row.querySelector(".type").value; c.width = num(row.querySelector(".width").value) || 10; c.align = row.querySelector(".align").value; c.visible = row.querySelector(".vis").checked; let nr = row.querySelector(".role").value; if (nr !== "none") state.columns.forEach(x => { if (x !== c && x.role === nr) x.role = "none"; }); c.role = nr; if (!old) c.key = normalizeKey(newLabel) + "_" + Date.now(); renderItems(); renderPreview(); save(); };
    row.querySelectorAll("input,select").forEach(e => e.onchange = sync); row.querySelector(".labelinput").oninput = () => { c.label = row.querySelector(".labelinput").value; renderPreview(); save(); };
    row.querySelector(".danger").onclick = () => { if (state.columns.length <= 1) return toast("At least one column is required."); state.columns.splice(idx, 1); renderColumns(); renderItems(); renderPreview(); save(); };
    row.querySelectorAll(".reorder").forEach(btn => btn.onclick = () => {
      if (btn.disabled) return;
      let target = btn.dataset.dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= state.columns.length) return;
      [state.columns[idx], state.columns[target]] = [state.columns[target], state.columns[idx]];
      renderColumns(); renderItems(); renderPreview(); save();
    });
    row.ondragstart = e => e.dataTransfer.setData("text/plain", idx); row.ondragover = e => e.preventDefault(); row.ondrop = e => { e.preventDefault(); let from = num(e.dataTransfer.getData("text/plain")); let moved = state.columns.splice(from, 1)[0]; state.columns.splice(idx, 0, moved); renderColumns(); renderItems(); renderPreview(); save(); }; root.appendChild(row);
  });
}
