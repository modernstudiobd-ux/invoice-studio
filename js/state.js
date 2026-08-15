// state.js — the single source of truth for the app's in-memory data, plus the
// constants/defaults that shape it. No rendering or DOM-writing logic lives
// here on purpose: everything else imports `state` and reads/writes it.

import { $, uid } from "./dom.js";

export const KEY = "invoiceStudioPro.v2";

export const defaultColumns = () => [
  { id: uid(), key: "sku", label: "SKU", type: "text", width: 14, align: "left", visible: true, role: "none" },
  { id: uid(), key: "description", label: "Description", type: "text", width: 44, align: "left", visible: true, role: "none" },
  { id: uid(), key: "quantity", label: "Qty", type: "number", width: 11, align: "right", visible: true, role: "quantity" },
  { id: uid(), key: "rate", label: "Rate", type: "currency", width: 14, align: "right", visible: true, role: "rate" },
  { id: uid(), key: "amount", label: "Amount", type: "currency", width: 17, align: "right", visible: true, role: "amount" }
];

export const sectionDefs = [
  ["logo", "Logo"], ["company", "Company details"], ["client", "Client details"], ["status", "Invoice status"],
  ["invoiceDate", "Invoice date"], ["dueDate", "Due date"], ["reference", "Reference / PO"], ["balance", "Balance due"],
  ["notes", "Notes"], ["discount", "Discount"], ["tax", "Tax"], ["shipping", "Shipping"], ["payment", "Payment details"],
  ["terms", "Terms"], ["footer", "Footer"]
];

// Every section defaults to shown except Invoice status, which most invoices
// don't need and is off until someone turns it on.
export const defaultSections = () => Object.fromEntries(sectionDefs.map(x => [x[0], x[0] !== "status"]));

export const state = {
  logo: "",
  logoNatural: null,
  zoom: 1,
  columns: defaultColumns(),
  items: [],
  sections: defaultSections()
};

export const fields = ["logoHeight", "logoPosition", "invoiceNumber", "status", "invoiceDate", "dueDate", "currency", "reference", "companyName", "companyReg", "companyVat", "companyAddress", "companyPhone", "companyEmail", "companyWebsite", "clientName", "clientContact", "clientTax", "clientAddress", "clientEmail", "discount", "tax", "shipping", "notes", "paymentDetails", "terms", "notesAlign", "template", "accent", "accentHex", "totalColorHex", "headerColorHex", "headerTextColorHex", "invoiceColorHex", "paperSize"];

export const DEFAULT_ACCENT = "#18181b";

export const PAPER_SIZES = {
  a4: { w: 210, h: 297, page: "A4", pdfName: "A4", ptW: 595.28, ptH: 841.89 },
  letter: { w: 215.9, h: 279.4, page: "215.9mm 279.4mm", pdfName: "LETTER", ptW: 612, ptH: 792 }
};

export function currentPaper() {
  const sel = $("paperSize");
  return PAPER_SIZES[sel ? sel.value : "a4"] || PAPER_SIZES.a4;
}

// Each template's own .invoice padding (top/right/bottom/left, mm) — must
// stay in sync with css/invoice.css's base .invoice rule and each
// .invoice.template-X rule in css/templates.css. Templates not listed here
// (currently just Corporate) don't override the base padding, so they use
// the "modern" entry below.
const TEMPLATE_PADDING_MM = {
  modern: { top: 12, right: 12, bottom: 11, left: 12 },
  classic: { top: 14, right: 14, bottom: 13, left: 14 },
  compact: { top: 10, right: 10, bottom: 9, left: 10 },
  apple: { top: 16, right: 16, bottom: 14, left: 16 },
  luxury: { top: 18, right: 16, bottom: 18, left: 16 },
  agency: { top: 16, right: 16, bottom: 14, left: 20 },
  medical: { top: 14, right: 14, bottom: 14, left: 14 },
  legal: { top: 16, right: 18, bottom: 16, left: 18 },
  realestate: { top: 14, right: 14, bottom: 14, left: 14 },
  freelancer: { top: 14, right: 14, bottom: 14, left: 14 },
  restaurant: { top: 14, right: 14, bottom: 14, left: 14 },
  retail: { top: 14, right: 14, bottom: 14, left: 14 },
  technology: { top: 14, right: 14, bottom: 14, left: 14 },
  manufacturing: { top: 12, right: 12, bottom: 12, left: 12 },
  dark: { top: 14, right: 14, bottom: 14, left: 14 }
};

// The footer's left/right inset always matches the template's own left/right
// padding, and its distance from the bottom edge is the template's own
// bottom padding minus 2mm (leaving a small gap above the physical page/paper
// edge) — the exact relationship "Modern Professional" already used
// (padding-bottom 11mm → footer 9mm from the bottom), now applied to every
// template instead of one hardcoded 12mm/9mm pair for all of them. Used for
// both the on-screen footer and the print footer (see print.css), which both
// read the same --footer-left/--footer-right custom properties.
export function templateFooterInsetMm(tpl) {
  const p = TEMPLATE_PADDING_MM[tpl] || TEMPLATE_PADDING_MM.modern;
  return { left: p.left, right: p.right, bottom: Math.max(0, p.bottom - 2) };
}

// Printed/PDF pages after the first get a top margin so a multi-page invoice
// doesn't look like it just abruptly continues flush against the page edge.
// The first page keeps margin 0 (matches the on-screen design, which already
// accounts for its own internal spacing).
export const PRINT_PAGE_TOP_MARGIN_MM = 14;

// Reserved space at the bottom of every printed page for the footer. The
// footer itself is the real ".footer" DOM element (already used for the
// on-screen preview), switched to position:fixed for print so it repeats on
// every page — see print.css. It used to be rendered via native CSS @page
// margin boxes (@bottom-left/@bottom-right) instead, but Firefox has
// essentially no support for margin-box content, which was silently
// dropping the entire footer there.
const PRINT_PAGE_BOTTOM_MARGIN_MM = 12;

function cssStringEscape(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ").trim();
}

export function applyPaperSize() {
  const p = currentPaper();
  document.documentElement.style.setProperty("--page-w", p.w + "mm");
  document.documentElement.style.setProperty("--page-h", p.h + "mm");
  // This is the single source of truth for @page — print.css intentionally
  // has no @page rule of its own, to avoid two separate @page declarations
  // (which Firefox's paged-media engine handles less predictably than
  // Chrome's) ever disagreeing with each other.
  $("pageSizeCSS").textContent =
    `@page{size:${p.page};margin:0;margin-top:${PRINT_PAGE_TOP_MARGIN_MM}mm;margin-bottom:${PRINT_PAGE_BOTTOM_MARGIN_MM}mm}` +
    `@page:first{margin-top:0}`;
}

// Snapshot everything needed to fully reconstruct the current invoice
// (used for localStorage autosave, History entries, export, and undo/redo).
export function serialize() {
  let f = {};
  fields.forEach(id => f[id] = $(id).value);
  return { version: 2, logo: state.logo, logoNatural: state.logoNatural, zoom: state.zoom, columns: state.columns, items: state.items, sections: state.sections, fields: f };
}
