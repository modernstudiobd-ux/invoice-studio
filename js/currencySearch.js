// currencySearch.js — turns the (hidden) native #currency <select> into a
// searchable combobox: a text input + filtered listbox layered on top.
//
// The <select> stays the single source of truth for the currency value —
// every other module (format.js, library.js, invoiceData.js, main.js's
// autosave binding, undo/redo, brand templates) keeps reading/writing
// $("currency").value exactly as before. Selecting an entry here just sets
// select.value and dispatches a real "change" event, so all of that keeps
// working untouched. syncCurrencyDisplay() is called from renderPreview()
// (which runs after every state-changing action app-wide) to keep the
// visible search text in sync even when the value changes from elsewhere
// (loading a saved invoice, undo/redo, applying a brand template, etc).

import { $ } from "./dom.js";

const select = $("currency");
const input = $("currencySearchInput");
const listEl = $("currencyListbox");
const combo = $("currencyCombo");

// Flatten the <select>'s <optgroup>/<option> markup once into a plain array
// — keeps the currency list single-sourced in the HTML instead of duplicated.
function buildEntries() {
  const entries = [];
  Array.from(select.children).forEach(child => {
    if (child.tagName === "OPTGROUP") {
      Array.from(child.children).forEach(opt => entries.push({ value: opt.value, label: opt.textContent, group: child.label }));
    } else if (child.tagName === "OPTION") {
      entries.push({ value: child.value, label: child.textContent, group: null });
    }
  });
  return entries;
}
const ENTRIES = buildEntries();

function labelFor(value) {
  const e = ENTRIES.find(en => en.value === value);
  return e ? e.label : value;
}

let filtered = [];
let activeIndex = -1;

export function syncCurrencyDisplay() {
  if (document.activeElement === input) return; // don't clobber while the user is actively searching
  input.value = labelFor(select.value);
}

function setActive(idx) {
  const prev = listEl.querySelector(".combobox-option.active");
  if (prev) prev.classList.remove("active");
  activeIndex = idx;
  if (idx < 0 || idx >= filtered.length) { input.removeAttribute("aria-activedescendant"); return; }
  const li = listEl.querySelector(`[data-index="${idx}"]`);
  if (li) {
    li.classList.add("active");
    input.setAttribute("aria-activedescendant", li.id);
    li.scrollIntoView({ block: "nearest" });
  }
}

function renderList(query) {
  const q = query.trim().toLowerCase();
  filtered = q ? ENTRIES.filter(en => en.label.toLowerCase().includes(q) || en.value.toLowerCase().includes(q)) : ENTRIES.slice();
  listEl.innerHTML = "";
  activeIndex = -1;
  input.removeAttribute("aria-activedescendant");
  if (!filtered.length) {
    const li = document.createElement("li");
    li.className = "combobox-empty";
    li.setAttribute("role", "presentation");
    li.textContent = "No matching currency";
    listEl.appendChild(li);
    return;
  }
  let lastGroup = null;
  filtered.forEach((en, i) => {
    if (en.group && en.group !== lastGroup) {
      const g = document.createElement("li");
      g.className = "combobox-group-label";
      g.setAttribute("role", "presentation");
      g.textContent = en.group;
      listEl.appendChild(g);
      lastGroup = en.group;
    }
    const li = document.createElement("li");
    li.className = "combobox-option" + (en.value === select.value ? " selected" : "");
    li.id = "currencyOpt-" + en.value;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", en.value === select.value ? "true" : "false");
    li.dataset.value = en.value;
    li.dataset.index = String(i);
    li.textContent = en.label;
    // mousedown (not click) fires before the input's blur, so the outside-
    // click handler below never gets a chance to close the list first.
    li.addEventListener("mousedown", ev => { ev.preventDefault(); chooseEntry(en); });
    listEl.appendChild(li);
  });
}

function chooseEntry(en) {
  if (select.value !== en.value) {
    select.value = en.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  input.value = en.label;
  closeList();
}

function openList() {
  if (combo.classList.contains("open")) return;
  combo.classList.add("open");
  input.setAttribute("aria-expanded", "true");
  renderList("");
  // Highlight (but don't overwrite) the current selection's row on open.
  const idx = filtered.findIndex(en => en.value === select.value);
  if (idx >= 0) setActive(idx);
}

function closeList() {
  combo.classList.remove("open");
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  syncCurrencyDisplay();
}

input.addEventListener("focus", () => { openList(); input.select(); });
input.addEventListener("click", () => { if (!combo.classList.contains("open")) openList(); });
input.addEventListener("input", () => { if (!combo.classList.contains("open")) openList(); else renderList(input.value); });

input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!combo.classList.contains("open")) { openList(); return; }
    setActive(Math.min(activeIndex + 1, filtered.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!combo.classList.contains("open")) { openList(); return; }
    setActive(Math.max(activeIndex - 1, 0));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (combo.classList.contains("open") && activeIndex >= 0 && filtered[activeIndex]) chooseEntry(filtered[activeIndex]);
    else if (combo.classList.contains("open") && filtered.length === 1) chooseEntry(filtered[0]);
  } else if (e.key === "Escape") {
    if (combo.classList.contains("open")) { e.preventDefault(); e.stopPropagation(); closeList(); }
  } else if (e.key === "Home" && combo.classList.contains("open")) {
    e.preventDefault(); setActive(0);
  } else if (e.key === "End" && combo.classList.contains("open")) {
    e.preventDefault(); setActive(filtered.length - 1);
  }
});

document.addEventListener("click", e => {
  const path = e.composedPath();
  if (!path.includes(combo)) closeList();
});

// Initial display text on boot.
syncCurrencyDisplay();
