// accent.js — the invoice's accent color (used across CSS via --accent / --accent-rgb).

import { $ } from "./dom.js";

export function safeColor(v) {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : "#2563eb";
}

export function setAccent(v) {
  v = safeColor(v);
  let h = v.slice(1), rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
  // Scoped to #invoice (not the document root) so this only ever affects the
  // invoice design — never the app's own sidebar/editor chrome.
  $("invoice").style.setProperty("--accent", v);
  $("invoice").style.setProperty("--accent-rgb", rgb);
  $("accent").value = v;
  $("accentHex").value = v;
}

// Optional overrides, independent of the accent color: Total due color, and
// Header background/Header text/Invoice area background. Each pairs a hex
// text field (the stored value — empty means "no override, use the
// template's own default") with a color-picker swatch (a convenience input,
// not itself persisted). All are scoped to #invoice, same as setAccent above.
const OPTIONAL_COLOR_VARS = {
  totalColor: { cssVar: "--total-color", hostClass: null },
  headerColor: { cssVar: "--header-bg", hostClass: "has-header-bg" },
  headerTextColor: { cssVar: "--header-text", hostClass: "has-header-text" },
  invoiceColor: { cssVar: "--invoice-bg", hostClass: null }
};

// Each template's own actual default for these four settings — must stay in
// sync with the CSS fallbacks in css/invoice.css and css/templates.css
// (search for var(--total-color, / var(--header-bg, / var(--invoice-bg,).
// Used only to make the *swatches* below show a template's real current
// color (Luxury's gold, Medical's teal, Corporate's navy, Dark's near-black
// canvas, etc.) whenever no override is set, instead of an arbitrary
// leftover value — so switching templates makes it obvious what a template's
// distinct palette actually is, and the picker starts from the right color
// if the person wants to adjust it. Not used for "Header text" (composed of
// several differently-colored elements) beyond the company name's own color,
// the most prominent header text element.
const TEMPLATE_DEFAULT_COLORS = {
  modern: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  classic: { total: "#1f2937", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  compact: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  apple: { total: "#18181b", headerBg: "#ffffff", headerText: "#1d1d1f", invoiceBg: "#ffffff" },
  corporate: { total: "#0b2545", headerBg: "#ffffff", headerText: "#0b2545", invoiceBg: "#ffffff" },
  luxury: { total: "#b08d57", headerBg: "#ffffff", headerText: "#2a231c", invoiceBg: "#ffffff" },
  agency: { total: "#ffffff", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  construction: { total: "#f2b705", headerBg: "#ffffff", headerText: "#1f2430", invoiceBg: "#ffffff" },
  medical: { total: "#0f6a63", headerBg: "#f4fbfa", headerText: "#0f6a63", invoiceBg: "#ffffff" },
  legal: { total: "#1f2937", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  realestate: { total: "#2b2b28", headerBg: "#ffffff", headerText: "#2b2b28", invoiceBg: "#ffffff" },
  freelancer: { total: "#18181b", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  restaurant: { total: "#4b5320", headerBg: "#ffffff", headerText: "#3c3a2f", invoiceBg: "#fbf9f4" },
  retail: { total: "#ffffff", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  technology: { total: "#7ee7c7", headerBg: "#ffffff", headerText: "#1f2937", invoiceBg: "#ffffff" },
  manufacturing: { total: "#1f2733", headerBg: "#ffffff", headerText: "#1f2733", invoiceBg: "#ffffff" },
  dark: { total: "#ffffff", headerBg: "#ffffff", headerText: "#ffffff", invoiceBg: "#111318" }
};
const OPTIONAL_COLOR_DEFAULT_KEY = { totalColor: "total", headerColor: "headerBg", headerTextColor: "headerText", invoiceColor: "invoiceBg" };

export function applyOptionalColor(id) {
  const cfg = OPTIONAL_COLOR_VARS[id];
  if (!cfg) return;
  const invoice = $("invoice");
  const hex = $(id + "Hex").value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    invoice.style.setProperty(cfg.cssVar, hex);
    $(id).value = hex;
    if (cfg.hostClass) invoice.classList.add(cfg.hostClass);
  } else {
    invoice.style.removeProperty(cfg.cssVar);
    if (cfg.hostClass) invoice.classList.remove(cfg.hostClass);
    // No override: show this template's own actual color in the swatch
    // (see TEMPLATE_DEFAULT_COLORS above) instead of leaving whatever the
    // previous template happened to show.
    const tplEl = $("template");
    const defaults = TEMPLATE_DEFAULT_COLORS[tplEl ? tplEl.value : "modern"] || TEMPLATE_DEFAULT_COLORS.modern;
    const key = OPTIONAL_COLOR_DEFAULT_KEY[id];
    if (key && defaults[key]) $(id).value = defaults[key];
  }
}

export function clearOptionalColor(id) {
  $(id + "Hex").value = "";
  applyOptionalColor(id);
}

export function applyAllOptionalColors() {
  Object.keys(OPTIONAL_COLOR_VARS).forEach(applyOptionalColor);
}
