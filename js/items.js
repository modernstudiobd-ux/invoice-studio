// items.js — line item creation. The sidebar's old "Items" tab (a card per
// item, mirroring what's on the canvas table) has been removed: every line
// item is already edited directly on the invoice canvas table in Edit mode
// (real <input>s in #pItems — see js/preview.js), so a second, separate
// editor for the same data was pure duplication. addItem() is still shared
// by the canvas's own "+ Add item" controls (empty-state and trailing row)
// and the CSV/Excel importer (js/importSheet.js via main.js), so there's
// exactly one place that knows how a new item is shaped.

import { state } from "./state.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";

export function addItem() {
  let item = {};
  state.columns.forEach(c => item[c.key] = c.role === "quantity" ? 1 : "");
  state.items.push(item);
  renderPreview();
  save();
}
