// columnCanvas.js — table column configuration, moved from the old sidebar
// "Table Columns" tab directly onto the invoice canvas table itself:
//   - each header cell (Edit mode only — see preview.js) is a real,
//     directly-editable control: type its heading to rename, grab the left
//     grip to drag-reorder (Excel-style, with a drop indicator), drag the
//     right edge to resize, or open its "⋮" menu for type/alignment/
//     calculation role/hide/remove
//   - a trailing "+" header cell adds a new column right there in the table
//   - the "Columns" button in the canvas toolbar (js/layout.js wires its
//     open/close/position, same pattern as History/Brand Templates/Import)
//     opens a fuller list for bulk work: reordering with arrows, restoring
//     the defaults, and — the one thing no header control can do, since a
//     hidden column has no header to click — re-showing a hidden column.
// Nothing here touches Preview or Print: every control rendered by this
// file only ever exists inside the Edit-mode table (preview.js checks
// isPreviewMode before calling buildColumnHeaderHtml/buildAddColumnHeaderHtml
// at all), and print.css separately hides this chrome by class, the same
// way it already hides the per-row remove buttons and the "+ Add item" row.

import { $, esc, uid } from "./dom.js";
import { state, defaultColumns } from "./state.js";
import { num, alignClass } from "./format.js";
import { toast } from "./toast.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

/* ----------------------------- header markup ---------------------------- */

// One editable <th> per visible column, rendered by preview.js in Edit mode.
// Keyed by the column's own `key` (not its array index) so a header stays
// correctly wired to its column through a drag-reorder — visible-array
// indices shift the instant a reorder happens, but `key` never does.
export function buildColumnHeaderHtml(c) {
  const removable = state.columns.length > 1;
  return `<th class="${alignClass(c.align)} col-head-cell" data-col-key="${esc(c.key)}">`
    + `<span class="col-drag-handle" data-key="${esc(c.key)}" title="Drag to reorder ${esc(c.label)}" aria-label="Drag to reorder ${esc(c.label)} column" role="button" tabindex="0">`
    + `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>`
    + `<div class="col-head-row">`
    + `<input type="text" class="col-label-input" data-key="${esc(c.key)}" value="${esc(c.label)}" aria-label="Heading for ${esc(c.label)} column" autocomplete="off" spellcheck="false">`
    + `<button type="button" class="col-menu-btn" data-key="${esc(c.key)}" title="Column settings" aria-label="Settings for ${esc(c.label)} column" aria-haspopup="true" aria-expanded="false">⋮</button>`
    + `</div>`
    + `<span class="col-resize-handle" data-key="${esc(c.key)}" title="Drag to resize" aria-hidden="true"></span>`
    + `</th>`;
}

// Trailing header cell — reuses the same 6%-wide reserved slot the per-row
// remove-item button column already sits under (see .item-actions-col in
// invoice.css / preview.js), just with a real control in it instead of
// being empty for the header row specifically.
export function buildAddColumnHeaderHtml() {
  return `<th class="item-actions-col col-actions-head" aria-label="Add a table column">`
    + `<button type="button" class="col-add-btn" id="addColumnCanvasBtn" title="Add column" aria-label="Add column">+</button>`
    + `</th>`;
}

/* ------------------------------ shared logic ----------------------------- */

function addColumn() {
  const i = state.columns.length + 1;
  state.columns.push({ id: uid(), key: "column_" + Date.now(), label: "Column " + i, type: "text", width: 15, align: "left", visible: true, role: "none" });
  renderPreview(); save();
}

function removeColumn(key) {
  if (state.columns.length <= 1) { toast("At least one column is required."); return; }
  const idx = state.columns.findIndex(c => c.key === key);
  if (idx === -1) return;
  state.columns.splice(idx, 1);
  renderPreview(); save();
}

function hideColumn(key) {
  const c = state.columns.find(c => c.key === key);
  if (!c) return;
  const visibleCount = state.columns.filter(x => x.visible).length;
  if (visibleCount <= 1) { toast("At least one visible column is required."); return; }
  c.visible = false;
  renderPreview(); save();
}

function setRole(c, role) {
  if (role !== "none") state.columns.forEach(x => { if (x !== c && x.role === role) x.role = "none"; });
  c.role = role;
}

/* ------------------------- live width updates (drag) --------------------- */

// Mirrors the <col> width math in preview.js's renderPreview() exactly, but
// only touches the <colgroup>'s <col> elements — never the header/body rows
// — so it can run on every pointermove of a resize drag without rebuilding
// (and thereby losing pointer capture on) the handle the person is actively
// dragging. The header text, totals, etc. all stay untouched mid-drag; a
// full renderPreview() only happens once, on pointerup, to settle everything
// (including the item cells' widths) from the committed state.
function updateColWidthsLive() {
  const visible = state.columns.filter(c => c.visible);
  const cols = $("pCols");
  if (!cols) return;
  const raw = visible.map(c => Math.max(5, num(c.width))), sum = raw.reduce((a, b) => a + b, 0) || 1;
  const colEls = Array.from(cols.children);
  raw.forEach((w, i) => { if (colEls[i]) colEls[i].style.width = (w / sum * 94).toFixed(2) + "%"; });
}

/* --------------------------------- drag reorder --------------------------------- */

let dropIndicator = null;
function ensureDropIndicator() {
  if (dropIndicator) return dropIndicator;
  dropIndicator = document.createElement("div");
  dropIndicator.className = "col-drop-indicator";
  $("floatingLayer").appendChild(dropIndicator);
  return dropIndicator;
}
function hideDropIndicator() { if (dropIndicator) dropIndicator.style.display = "none"; }

function headerCells() {
  return Array.from(document.querySelectorAll("#pHeaders th.col-head-cell"));
}

function startReorderDrag(handle, startEvent) {
  const dragKey = handle.dataset.key;
  const th = handle.closest("th");
  if (!th) return;
  th.classList.add("col-dragging");
  const indicator = ensureDropIndicator();
  let dropKey = null, dropBefore = true;

  function onMove(e) {
    const cells = headerCells().filter(c => c.dataset.colKey !== dragKey);
    let best = null, bestDist = Infinity;
    cells.forEach(cell => {
      const r = cell.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const d = Math.abs(e.clientX - cx);
      if (d < bestDist) { bestDist = d; best = { cell, r, cx }; }
    });
    if (!best) return;
    dropKey = best.cell.dataset.colKey;
    dropBefore = e.clientX < best.cx;
    const x = dropBefore ? best.r.left : best.r.right;
    indicator.style.display = "block";
    indicator.style.left = (x - 1) + "px";
    indicator.style.top = best.r.top + "px";
    indicator.style.height = best.r.height + "px";
  }
  function onUp() {
    handle.releasePointerCapture(startEvent.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    th.classList.remove("col-dragging");
    hideDropIndicator();
    if (dropKey && dropKey !== dragKey) {
      const fromIdx = state.columns.findIndex(c => c.key === dragKey);
      let toIdx = state.columns.findIndex(c => c.key === dropKey);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = state.columns.splice(fromIdx, 1);
      toIdx = state.columns.findIndex(c => c.key === dropKey);
      state.columns.splice(dropBefore ? toIdx : toIdx + 1, 0, moved);
      renderPreview(); save();
    }
  }
  handle.setPointerCapture(startEvent.pointerId);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

/* ----------------------------------- resize ----------------------------------- */

function startResizeDrag(handle, startEvent) {
  const key = handle.dataset.key;
  const col = state.columns.find(c => c.key === key);
  const table = handle.closest("table");
  if (!col || !table) return;
  const startX = startEvent.clientX;
  const startWidth = num(col.width);
  const tableWidthPx = table.getBoundingClientRect().width || 1;
  handle.classList.add("resizing");

  function onMove(e) {
    const deltaUnits = (e.clientX - startX) / tableWidthPx * 100;
    col.width = Math.max(5, Math.min(80, startWidth + deltaUnits));
    updateColWidthsLive();
  }
  function onUp() {
    handle.releasePointerCapture(startEvent.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    handle.classList.remove("resizing");
    renderPreview(); save();
  }
  handle.setPointerCapture(startEvent.pointerId);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

/* ------------------------------ per-column popover ------------------------------ */

let colSettingsKey = null;
function openColSettings(triggerBtn) {
  const key = triggerBtn.dataset.key;
  const c = state.columns.find(c => c.key === key);
  if (!c) return;
  colSettingsKey = key;
  const panel = $("colSettingsPanel");
  $("colSettingsTitle").textContent = (c.label || "Column") + " settings";
  $("colSettingsType").value = c.type;
  $("colSettingsAlign").value = c.align;
  $("colSettingsRole").value = c.role;
  panel.classList.add("open");
  triggerBtn.setAttribute("aria-expanded", "true");
  const r = triggerBtn.getBoundingClientRect();
  const width = Math.min(260, window.innerWidth - 32);
  let left = r.left + r.width / 2 - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  panel.style.width = width + "px";
  panel.style.left = left + "px";
  const estimatedHeight = Math.min(panel.scrollHeight || 260, window.innerHeight * 0.7);
  const spaceBelow = window.innerHeight - r.bottom - 8;
  panel.style.top = (spaceBelow < estimatedHeight && r.top > estimatedHeight ? Math.max(8, r.top - estimatedHeight - 8) : r.bottom + 8) + "px";
}
export function closeColSettings() {
  const panel = $("colSettingsPanel");
  panel.classList.remove("open");
  document.querySelectorAll(".col-menu-btn[aria-expanded=true]").forEach(b => b.setAttribute("aria-expanded", "false"));
  colSettingsKey = null;
}

/* --------------------------------- manage list ---------------------------------- */

// The fuller list shown in the "Columns" toolbar popover (js/layout.js owns
// opening/closing/positioning #manageColumnsPanel itself, the same way it
// already does for History/Brand Templates/Import — this only fills its
// content). Same fields the old sidebar tab had, just relocated.
export function renderColumnManagerList() {
  const root = $("columnManagerList");
  if (!root) return;
  root.innerHTML = "";
  state.columns.forEach((c, idx) => {
    const row = document.createElement("div");
    row.className = "columnrow";
    const uidStr = "colmgr" + idx + "_" + c.id;
    row.innerHTML = `<div class="columnhead"><button class="btn icon reorder" data-dir="up" aria-label="Move column ${idx + 1} up" ${idx === 0 ? "disabled" : ""}>↑</button><button class="btn icon reorder" data-dir="down" aria-label="Move column ${idx + 1} down" ${idx === state.columns.length - 1 ? "disabled" : ""}>↓</button><span class="drag" aria-hidden="true">☰</span><strong>Column ${idx + 1}</strong><label class="tiny" for="${uidStr}-vis"><input id="${uidStr}-vis" class="vis" type="checkbox" ${c.visible ? "checked" : ""}> Show</label><button class="btn icon danger" aria-label="Remove column ${idx + 1}" title="Remove column">×</button></div><div class="colgrid"><div class="field"><label for="${uidStr}-label">Heading</label><input id="${uidStr}-label" class="labelinput" value="${esc(c.label)}"></div><div class="field"><label for="${uidStr}-type">Type</label><select id="${uidStr}-type" class="type"><option value="text">Text</option><option value="number">Number</option><option value="currency">Currency</option><option value="percentage">Percentage</option><option value="date">Date</option></select></div><div class="field"><label for="${uidStr}-width">Width %</label><input id="${uidStr}-width" class="width" type="number" min="5" max="80" value="${c.width}"></div><div class="field"><label for="${uidStr}-align">Alignment</label><select id="${uidStr}-align" class="align"><option value="left">Left</option><option value="right">Right</option><option value="center">Center</option></select></div><div class="field"><label for="${uidStr}-role">Calculation role</label><select id="${uidStr}-role" class="role"><option value="none">None</option><option value="quantity">Quantity</option><option value="rate">Rate</option><option value="amount">Amount</option></select></div></div>`;
    row.querySelector(".type").value = c.type; row.querySelector(".align").value = c.align; row.querySelector(".role").value = c.role;
    const sync = () => {
      const newLabel = row.querySelector(".labelinput").value.trim() || "Column";
      c.label = newLabel; c.type = row.querySelector(".type").value; c.width = num(row.querySelector(".width").value) || 10;
      c.align = row.querySelector(".align").value; c.visible = row.querySelector(".vis").checked;
      setRole(c, row.querySelector(".role").value);
      renderPreview(); save();
    };
    row.querySelectorAll("input,select").forEach(e => e.onchange = sync);
    row.querySelector(".labelinput").oninput = () => { c.label = row.querySelector(".labelinput").value; renderPreview(); save(); };
    row.querySelector(".danger").onclick = () => removeColumn(c.key);
    row.querySelectorAll(".reorder").forEach(btn => btn.onclick = () => {
      if (btn.disabled) return;
      const target = btn.dataset.dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= state.columns.length) return;
      [state.columns[idx], state.columns[target]] = [state.columns[target], state.columns[idx]];
      renderColumnManagerList(); renderPreview(); save();
    });
    row.draggable = true;
    row.ondragstart = e => e.dataTransfer.setData("text/plain", String(idx));
    row.ondragover = e => e.preventDefault();
    row.ondrop = e => { e.preventDefault(); const from = num(e.dataTransfer.getData("text/plain")); const moved = state.columns.splice(from, 1)[0]; state.columns.splice(idx, 0, moved); renderColumnManagerList(); renderPreview(); save(); };
    root.appendChild(row);
  });
}

/* ------------------------------- wiring (once) ----------------------------------- */

export function initColumnCanvas() {
  $("addColumnBtn").onclick = () => { addColumn(); renderColumnManagerList(); };
  $("restoreColumnsBtn").onclick = () => {
    if (!confirm("Restore the default five columns?")) return;
    state.columns = defaultColumns();
    renderColumnManagerList(); renderPreview(); save();
  };

  // Every control below lives inside #pHeaders, which preview.js rebuilds
  // (innerHTML) on every full render — so, like the item-cell-input/
  // item-remove-btn handling in main.js, everything is delegated on
  // document rather than bound per-element.
  document.addEventListener("click", e => {
    if (e.target.closest("#addColumnCanvasBtn")) { addColumn(); return; }
    const removeBtn = e.target.closest(".col-remove-btn");
    if (removeBtn) { removeColumn(removeBtn.dataset.key); return; }
    const menuBtn = e.target.closest(".col-menu-btn");
    if (menuBtn) {
      e.stopPropagation();
      if (colSettingsKey === menuBtn.dataset.key && $("colSettingsPanel").classList.contains("open")) closeColSettings();
      else { closeColSettings(); openColSettings(menuBtn); menuBtn.setAttribute("aria-expanded", "true"); }
      return;
    }
    if (!e.target.closest("#colSettingsPanel")) closeColSettings();
  });

  document.addEventListener("input", e => {
    const labelInput = e.target.closest(".col-label-input");
    if (!labelInput) return;
    const c = state.columns.find(c => c.key === labelInput.dataset.key);
    if (!c) return;
    // Renaming only ever changes this input's own text (nothing else on
    // screen mirrors a column's label) — no renderPreview() needed, which
    // matters here for the same reason it matters for item cells: it would
    // rebuild #pHeaders on every keystroke and yank the caret out from under
    // whoever's typing.
    c.label = labelInput.value;
    save();
  });
  document.addEventListener("change", e => {
    const labelInput = e.target.closest(".col-label-input");
    if (!labelInput) return;
    const c = state.columns.find(c => c.key === labelInput.dataset.key);
    if (c && !c.label.trim()) { c.label = "Column"; labelInput.value = "Column"; save(); }
  });

  document.addEventListener("pointerdown", e => {
    const handle = e.target.closest(".col-drag-handle");
    if (handle) { e.preventDefault(); startReorderDrag(handle, e); return; }
    const resizer = e.target.closest(".col-resize-handle");
    if (resizer) { e.preventDefault(); startResizeDrag(resizer, e); return; }
  });

  /* --- column settings popover fields --- */
  $("colSettingsType").addEventListener("change", () => {
    const c = state.columns.find(c => c.key === colSettingsKey);
    if (!c) return;
    c.type = $("colSettingsType").value;
    renderPreview(); save();
  });
  $("colSettingsAlign").addEventListener("change", () => {
    const c = state.columns.find(c => c.key === colSettingsKey);
    if (!c) return;
    c.align = $("colSettingsAlign").value;
    renderPreview(); save();
  });
  $("colSettingsRole").addEventListener("change", () => {
    const c = state.columns.find(c => c.key === colSettingsKey);
    if (!c) return;
    setRole(c, $("colSettingsRole").value);
    renderPreview(); save();
  });
  $("colSettingsHideBtn").addEventListener("click", () => { if (colSettingsKey) { hideColumn(colSettingsKey); closeColSettings(); } });
  $("colSettingsRemoveBtn").addEventListener("click", () => { if (colSettingsKey) { removeColumn(colSettingsKey); closeColSettings(); } });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("colSettingsPanel").classList.contains("open")) closeColSettings();
  });
  window.addEventListener("resize", closeColSettings);
}
