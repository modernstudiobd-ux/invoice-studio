// persistence.js — autosave to localStorage, plus the undo/redo edit-history
// stack (separate from the multi-invoice "History" library in library.js).

import { $ } from "./dom.js";
import { KEY, serialize } from "./state.js";
import { toast } from "./toast.js";

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(serialize())); }
  catch { toast("Could not save locally — your browser's storage may be full (try a smaller logo)."); }
  pushEditHistory();
}

let editHistory = [], editHistoryIndex = -1, restoringHistory = false;
const EDIT_HISTORY_LIMIT = 50;

export function isRestoringHistory() {
  return restoringHistory;
}

export function pushEditHistory() {
  if (restoringHistory) return;
  const snap = JSON.stringify(serialize());
  if (editHistory[editHistoryIndex] === snap) return;
  editHistory = editHistory.slice(0, editHistoryIndex + 1);
  editHistory.push(snap);
  if (editHistory.length > EDIT_HISTORY_LIMIT) editHistory.shift();
  editHistoryIndex = editHistory.length - 1;
  updateUndoRedoButtons();
}

// `loadFn` is passed in by main.js rather than imported directly, to avoid a
// persistence.js <-> invoiceData.js circular import.
export function undo(loadFn) {
  if (editHistoryIndex <= 0) return;
  editHistoryIndex--;
  restoringHistory = true; loadFn(JSON.parse(editHistory[editHistoryIndex])); restoringHistory = false;
  updateUndoRedoButtons();
}

export function redo(loadFn) {
  if (editHistoryIndex >= editHistory.length - 1) return;
  editHistoryIndex++;
  restoringHistory = true; loadFn(JSON.parse(editHistory[editHistoryIndex])); restoringHistory = false;
  updateUndoRedoButtons();
}

export function updateUndoRedoButtons() {
  const u = $("undoBtn"), r = $("redoBtn");
  if (u) u.disabled = editHistoryIndex <= 0;
  if (r) r.disabled = editHistoryIndex >= editHistory.length - 1;
}
