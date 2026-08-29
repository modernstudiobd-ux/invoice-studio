// inlineEdit.js — makes the live preview itself directly editable: every
// text field, label, table cell/column, summary number, status, date and
// the logo can all be edited right on the invoice, not just in the sidebar.
//
// Design: a handful of delegated listeners on #invoice (focusin/focusout/
// keydown/click/paste/pointerdown/drag-drop), driven entirely by
// `data-editable="<kind>:<...>"` attributes baked into the preview's HTML
// (see index.html and the dynamic header/row markup in preview.js). This
// means new/rebuilt DOM (e.g. every time renderPreview() regenerates the
// item rows) is wired up automatically — nothing needs re-attaching after
// a render, since the listeners live on the stable #invoice container.
//
// Editing funnels back into the exact same state + sidebar fields the form
// already uses: a plain text/number field dispatches a real "input"/"change"
// event on its hidden sidebar counterpart (reusing every existing listener
// in main.js — render, autosave, undo history, all of it) rather than
// duplicating that logic here. Only things with no sidebar counterpart
// (item cells, column labels/widths, document labels, meta overrides) write
// straight into `state` and call renderPreview()/save() directly.

import { $ } from "./dom.js";
import { state, defaultLabels } from "./state.js";
import { num } from "./format.js";
import { renderPreview } from "./preview.js";
import { renderItems } from "./items.js";
import { renderColumns } from "./columns.js";
import { save } from "./persistence.js";
import { handleLogoFile, removeLogo } from "./logo.js";

const STATUS_ORDER = ["Draft", "Due", "Paid", "Partially Paid", "Overdue", "Canceled"];
const MULTILINE_FIELDS = new Set(["notes", "paymentDetails", "terms"]);
// Placeholder copy shown when a field is empty — cleared automatically when
// the person starts editing it, so they aren't stuck deleting hint text.
const PLACEHOLDERS = new Set(["Your Company", "Client company", "Add your company details", "Add client details", "—", "Add payment details."]);

// Remembers each element's content at focus-in, so Escape can restore it.
const editOriginal = new WeakMap();

function parseSpec(raw) {
  const parts = String(raw || "").split(":");
  const kind = parts[0];
  if (kind === "field") return { kind, field: parts[1], numericKind: parts[2] === "percent" ? "percent" : parts[2] === "number" ? "number" : null, dateSwap: parts[2] === "date" };
  if (kind === "label") return { kind, name: parts[1] };
  if (kind === "meta") return { kind, name: parts[1] };
  if (kind === "colhead") return { kind, colId: parts[1] };
  if (kind === "item") return { kind, idx: Number(parts[1]), key: parts[2], itemType: parts[3] };
  return { kind: "unknown" };
}

function isMultilineSpec(spec) {
  if (spec.kind === "meta") return true;
  if (spec.kind === "field") return MULTILINE_FIELDS.has(spec.field);
  if (spec.kind === "item") { const col = state.columns.find(c => c.key === spec.key); return !!(col && col.key === "description" && col.type === "text"); }
  return false;
}

function readText(el, multiline) {
  let t = (el.innerText !== undefined ? el.innerText : el.textContent) || "";
  t = t.replace(/\r\n/g, "\n");
  if (!multiline) t = t.replace(/\n+/g, " ");
  return t.trim();
}

function placeCaretAtEnd(el) {
  el.focus();
  if (window.getSelection && document.createRange) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Fires the exact event main.js's `fields.forEach(...)` binding listens for,
// so every existing side effect (render, autosave, undo history, the
// accent/optional-color special cases) runs exactly as if the person had
// typed into the sidebar field itself.
function dispatchNative(el) {
  const evName = el.tagName === "SELECT" ? "change" : "input";
  el.dispatchEvent(new Event(evName, { bubbles: true }));
}

/* ---------------------------- focus / commit ---------------------------- */

function onFocusIn(e) {
  const el = e.target.closest("[data-editable]");
  if (!el || !el.isContentEditable) return;
  el.classList.add("is-editing");
  editOriginal.set(el, el.innerHTML);
  const spec = parseSpec(el.dataset.editable);
  // Numeric fields/cells show a plain unformatted number while being edited
  // (e.g. "1234.5" instead of "$1,234.50") — much easier to type into.
  if (spec.kind === "field" && spec.numericKind) {
    const fieldEl = $(spec.field);
    el.textContent = (fieldEl && fieldEl.value) || "0";
    placeCaretAtEnd(el);
    return;
  }
  if (spec.kind === "item" && ["number", "currency", "percentage"].includes(spec.itemType)) {
    const item = state.items[spec.idx];
    el.textContent = item ? String(item[spec.key] ?? "") : "";
    placeCaretAtEnd(el);
    return;
  }
  if (PLACEHOLDERS.has(el.textContent.trim())) el.textContent = "";
}

function onFocusOut(e) {
  const el = e.target.closest("[data-editable]");
  if (!el || !el.isContentEditable) return;
  el.classList.remove("is-editing");
  editOriginal.delete(el);
  commit(parseSpec(el.dataset.editable), el);
}

function commit(spec, el) {
  switch (spec.kind) {
    case "field": {
      let text = readText(el, isMultilineSpec(spec));
      const prefix = el.dataset.prefix;
      if (prefix && text.startsWith(prefix)) text = text.slice(prefix.length).trim();
      const fieldEl = $(spec.field);
      if (!fieldEl) return;
      if (spec.numericKind) {
        let n = num(text);
        n = spec.numericKind === "percent" ? Math.max(0, Math.min(100, n)) : Math.max(0, n);
        fieldEl.value = String(n);
      } else {
        fieldEl.value = text;
      }
      dispatchNative(fieldEl);
      return;
    }
    case "label": {
      const text = readText(el, false);
      state.labels[spec.name] = text || defaultLabels()[spec.name] || "";
      renderPreview(); save();
      return;
    }
    case "meta": {
      const text = readText(el, true);
      state.overrides[spec.name] = text === "" ? null : text;
      renderPreview(); save();
      return;
    }
    case "colhead": {
      const col = state.columns.find(c => c.id === spec.colId);
      if (col) col.label = readText(el, false) || col.label;
      renderColumns(); renderPreview(); save();
      return;
    }
    case "item": {
      const item = state.items[spec.idx];
      if (!item) return;
      const col = state.columns.find(c => c.key === spec.key);
      let val = readText(el, isMultilineSpec(spec));
      if (col && ["number", "currency", "percentage"].includes(col.type)) val = num(val);
      item[spec.key] = val;
      renderItems(); renderPreview(); save();
      return;
    }
  }
}

/* --------------------------------- keys ---------------------------------- */

function onKeyDown(e) {
  if (e.key === "Enter" || e.key === " ") {
    if (e.target.closest('[data-editable="status"]')) { e.preventDefault(); cycleStatus(); return; }
    const dateCell = e.target.closest('[data-editable$=":date"]');
    if (dateCell) { e.preventDefault(); openDateEditor(dateCell); return; }
    if (e.key === "Enter" && e.target.closest('[data-action="add-item"]')) { e.preventDefault(); addItem(); return; }
  }
  const el = e.target.closest("[data-editable]");
  if (!el || !el.isContentEditable) return;
  const spec = parseSpec(el.dataset.editable);
  const multiline = isMultilineSpec(spec);
  if (e.key === "Enter") {
    if (multiline) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); el.blur(); } }
    else { e.preventDefault(); el.blur(); }
  } else if (e.key === "Escape") {
    e.preventDefault();
    const original = editOriginal.get(el);
    if (original !== undefined) el.innerHTML = original;
    el.blur();
  }
}

// Contenteditable's default paste brings along the source's own formatting
// (fonts, colors, sometimes whole tables) — always insert plain text instead,
// so a paste from Word/Gmail/etc. can't break the invoice's own styling.
function onPaste(e) {
  const el = e.target.closest("[data-editable]");
  if (!el || !el.isContentEditable) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
}

/* -------------------------------- status --------------------------------- */

function cycleStatus() {
  const sel = $("status");
  const idx = STATUS_ORDER.indexOf(sel.value);
  sel.value = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
  dispatchNative(sel);
}

/* ------------------------------- date cells ------------------------------- */

function openDateEditor(cell) {
  if (cell.querySelector("input")) return;
  const spec = parseSpec(cell.dataset.editable);
  const fieldEl = $(spec.field);
  if (!fieldEl) return;
  const input = document.createElement("input");
  input.type = "date";
  input.className = "inline-date-input";
  input.value = fieldEl.value || "";
  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  try { input.showPicker && input.showPicker(); } catch {}
  input.addEventListener("change", () => { fieldEl.value = input.value; dispatchNative(fieldEl); });
  input.addEventListener("blur", () => {
    // renderPreview() (already triggered above if the value changed) rebuilds
    // this cell's formatted text and removes the input as a side effect; if
    // nothing changed, force that same rebuild here to restore the display.
    if (cell.contains(input)) renderPreview();
  }, { once: true });
}

/* -------------------------------- items ----------------------------------- */

function addItem() {
  const item = {};
  state.columns.forEach(c => item[c.key] = c.role === "quantity" ? 1 : "");
  state.items.push(item);
  renderItems(); renderPreview(); save();
}

function deleteItem(idx) {
  if (!(idx >= 0 && idx < state.items.length)) return;
  state.items.splice(idx, 1);
  renderItems(); renderPreview(); save();
}

/* --------------------------------- clicks ---------------------------------- */

function onClick(e) {
  if (e.target.closest('[data-action="add-item"]')) { addItem(); return; }
  const delBtn = e.target.closest('[data-action="delete-item"]');
  if (delBtn) { deleteItem(Number(delBtn.dataset.idx)); return; }
  if (e.target.closest('[data-editable="status"]')) { cycleStatus(); return; }
  const dateCell = e.target.closest('[data-editable$=":date"]');
  if (dateCell) { openDateEditor(dateCell); return; }
  if (e.target.closest("#logoRemoveInline")) { removeLogo(); return; }
  if (e.target.closest("#logoPositionInline")) { toggleLogoPosition(); return; }
  const logoBox = e.target.closest(".logobox");
  if (logoBox && !state.logo && !e.target.closest("button") && !e.target.closest(".logo-resize-handle")) { $("logoFile").click(); }
}

/* --------------------------------- logo ------------------------------------ */

function toggleLogoPosition() {
  const sel = $("logoPosition");
  const order = ["", "left", "above"];
  const idx = order.indexOf(sel.value);
  sel.value = order[(idx + 1) % order.length];
  dispatchNative(sel);
}

function onDragOver(e) {
  const box = e.target.closest(".logobox");
  if (!box) return;
  e.preventDefault();
  box.classList.add("drag-over");
}
function onDragLeave(e) {
  const box = e.target.closest(".logobox");
  if (box) box.classList.remove("drag-over");
}
function onDrop(e) {
  const box = e.target.closest(".logobox");
  if (!box) return;
  e.preventDefault();
  box.classList.remove("drag-over");
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleLogoFile(file);
}

/* ------------------------- drag-to-resize (logo + columns) ------------------------- */

// Both the logo-resize handle and the column-resize handles use plain
// document-level pointermove/pointerup listeners (no setPointerCapture) —
// renderPreview() rebuilds the item table's DOM on every animation frame
// while dragging a column border, which would detach a captured target and
// risk losing the drag; a document-level listener keeps working regardless.
function onPointerDown(e) {
  const colHandle = e.target.closest('[data-action="col-resize"]');
  if (colHandle) { e.preventDefault(); startColumnResize(e, colHandle); return; }
  const logoHandle = e.target.closest('[data-action="logo-resize"]');
  if (logoHandle) { e.preventDefault(); startLogoResize(e); return; }
}

function currentScale() {
  const inv = $("invoice");
  if (!inv || !inv.offsetWidth) return 1;
  return inv.getBoundingClientRect().width / inv.offsetWidth || 1;
}

function startColumnResize(e, handle) {
  const colId = handle.dataset.colId;
  const visible = state.columns.filter(c => c.visible);
  const idx = visible.findIndex(c => c.id === colId);
  if (idx === -1 || idx === visible.length - 1) return;
  const colA = visible[idx], colB = visible[idx + 1];
  const table = document.querySelector(".invtable");
  if (!table) return;
  const tableWidthPx = table.getBoundingClientRect().width || 1;
  const scale = currentScale();
  const sum = visible.reduce((s, c) => s + Math.max(5, num(c.width)), 0) || 1;
  const startX = e.clientX;
  const startA = Math.max(5, num(colA.width)), startB = Math.max(5, num(colB.width));
  let raf = null;
  function onMove(ev) {
    const dxPx = (ev.clientX - startX) / scale;
    const dxUnits = (dxPx / tableWidthPx) * sum;
    let na = startA + dxUnits, nb = startB - dxUnits;
    if (na < 5) { nb -= (5 - na); na = 5; }
    if (nb < 5) { na -= (5 - nb); nb = 5; }
    colA.width = Math.round(na * 100) / 100;
    colB.width = Math.round(nb * 100) / 100;
    if (raf) return;
    raf = requestAnimationFrame(() => { renderPreview(); raf = null; });
  }
  function onUp() {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    if (raf) cancelAnimationFrame(raf);
    renderColumns(); renderPreview(); save();
  }
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function startLogoResize(e) {
  const startY = e.clientY;
  const scale = currentScale();
  const startH = num($("logoHeight").value) || 48;
  let raf = null;
  function onMove(ev) {
    const dy = (ev.clientY - startY) / scale;
    const nh = Math.max(24, Math.min(160, Math.round(startH + dy)));
    $("logoHeight").value = nh;
    if (raf) return;
    raf = requestAnimationFrame(() => { renderPreview(); raf = null; });
  }
  function onUp() {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    if (raf) cancelAnimationFrame(raf);
    save();
  }
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

/* --------------------------------- init ------------------------------------ */

export function initInlineEdit() {
  const invoice = $("invoice");
  if (!invoice) return;
  invoice.addEventListener("focusin", onFocusIn);
  invoice.addEventListener("focusout", onFocusOut);
  invoice.addEventListener("keydown", onKeyDown);
  invoice.addEventListener("paste", onPaste);
  invoice.addEventListener("click", onClick);
  invoice.addEventListener("dragover", onDragOver);
  invoice.addEventListener("dragleave", onDragLeave);
  invoice.addEventListener("drop", onDrop);
  invoice.addEventListener("pointerdown", onPointerDown);
}
