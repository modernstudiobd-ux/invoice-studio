// preview.js — renders the live invoice document (the on-screen A4/Letter canvas).

import { $, esc } from "./dom.js";
import { state, currentPaper, applyPaperSize, templateFooterInsetMm, templatePaddingMm } from "./state.js";
import { money, dateFmt, alignClass, fmtCell, num } from "./format.js";
import { calc, itemValue } from "./calc.js";
import { applyAllOptionalColors } from "./accent.js";
import { syncCurrencyDisplay } from "./currencySearch.js";

// Maps each Details-tab label input's id to its key in state.labels — used
// both by renderPreview() (to keep the inputs in sync with state) and by
// main.js (to wire their change → state.labels handlers).
export const LABEL_FIELD_IDS = [
  ["labelTitle", "title"], ["labelBillTo", "bill"], ["labelBalance", "balance"],
  ["labelNote", "note"], ["labelPayment", "payment"], ["labelTerms", "terms"],
  ["labelInvoiceDate", "date"], ["labelDueDate", "due"], ["labelReference", "ref"]
];

// Writes text into a preview element — a thin wrapper kept mainly so every
// preview text update goes through one place (guards against a missing
// element cleanly, same as the rest of this file's helpers).
function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

export function renderPreview() {
  syncCurrencyDisplay();
  let inv = $("invoice"), tpl = $("template").value;
  const logoPos = $("logoPosition").value;
  const notesAlign = $("notesAlign").value || "left";
  inv.className = "invoice template-" + tpl + (logoPos ? " logo-position-" + logoPos : "") + " notes-align-" + notesAlign;
  // renderPreview() resets the invoice's className above (to swap the
  // template/layout classes) — that wipes the has-header-bg/has-header-text
  // toggle classes set by the optional color overrides, so re-derive them
  // here from the current HEX fields every time a render happens.
  applyAllOptionalColors();
  // Footer inset matches this template's own padding (see TEMPLATE_PADDING_MM
  // in state.js) — the same values the print footer uses — instead of a
  // fixed 12mm/9mm inset borrowed from Modern Professional for every template.
  const footerInset = templateFooterInsetMm(tpl);
  inv.style.setProperty("--footer-left", footerInset.left + "mm");
  inv.style.setProperty("--footer-right", footerInset.right + "mm");
  inv.style.setProperty("--footer-bottom", footerInset.bottom + "mm");
  applyPaperSize();
  // Document labels ("INVOICE", "Bill to", ...) are renamed via the Details
  // tab's label:* inputs (see main.js) and persisted in state.labels; keep
  // those inputs themselves in sync too (e.g. after Undo, importing a JSON
  // file, or loading a Saved Invoice/Brand Template changes state.labels
  // without the person having touched the input directly).
  const labels = state.labels;
  LABEL_FIELD_IDS.forEach(([id, key]) => {
    const el = $(id);
    if (el && document.activeElement !== el && el.value !== (labels[key] || "")) el.value = labels[key] || "";
  });
  setText($("pInvoiceTitle"), labels.title);
  setText($("pBillToLabel"), labels.bill);
  setText($("pBalanceLabel"), labels.balance);
  setText($("pNoteLabel"), labels.note);
  setText($("pPaymentLabel"), labels.payment);
  setText($("pTermsLabel"), labels.terms);
  setText($("pDateLabel"), labels.date);
  setText($("pDueLabel"), labels.due);
  setText($("pReferenceLabel"), labels.ref);
  setText($("pCompanyName"), $("companyName").value.trim() || "Your Company");
  setMetaField($("pCompanyReg"), $("companyReg").value.trim(), "Registration: ");
  setMetaField($("pCompanyVat"), $("companyVat").value.trim(), "VAT / Tax: ");
  setMetaField($("pCompanyAddress"), $("companyAddress").value.trim(), "");
  setMetaField($("pCompanyPhone"), $("companyPhone").value.trim(), "Phone: ");
  setMetaField($("pCompanyEmail"), $("companyEmail").value.trim(), "Email: ");
  setMetaField($("pCompanyWebsite"), $("companyWebsite").value.trim(), "");
  let no = $("invoiceNumber").value.trim() || "Untitled";
  setText($("pInvoiceNo"), "#" + no);
  const invoiceDateVal = $("invoiceDate").value;
  const dueDateVal = $("dueDate").value;
  setText($("pDate"), dateFmt(invoiceDateVal));
  setText($("pDue"), dateFmt(dueDateVal));
  const referenceText = $("reference").value.trim();
  setText($("pReference"), referenceText || "—");
  setText($("pClientName"), $("clientName").value.trim() || "Client company");
  setMetaField($("pClientContact"), $("clientContact").value.trim(), "");
  setMetaField($("pClientTax"), $("clientTax").value.trim(), "VAT / Tax: ");
  setMetaField($("pClientAddress"), $("clientAddress").value.trim(), "");
  setMetaField($("pClientEmail"), $("clientEmail").value.trim(), "");
  const notesText = $("notes").value.trim();
  const termsText = $("terms").value.trim();
  setText($("pNotes"), notesText);
  setText($("pPayment"), $("paymentDetails").value.trim());
  setText($("pTerms"), termsText);
  setText($("pFooterCompany"), $("companyName").value.trim() || "Your Company");
  setText($("pFooterInvoice"), "Invoice #" + no);
  let status = $("status").value, p = $("pStatus"), styles = { Draft: ["#475467", "#f2f4f7", "#d0d5dd"], Due: ["#18794e", "#ecfdf3", "#abefc6"], Paid: ["#175cd3", "#eff8ff", "#b2ddff"], "Partially Paid": ["#9a6700", "#fffaeb", "#fedf89"], Overdue: ["#b42318", "#fef3f2", "#fecdca"], Canceled: ["#667085", "#f2f4f7", "#d0d5dd"] }[status] || ["#475467", "#f2f4f7", "#d0d5dd"];
  // Status is click-to-cycle (not a text edit), so it always updates —
  // there's no caret to protect, and it should reflect a click immediately
  // even though the badge keeps keyboard focus afterward.
  p.textContent = "● " + status; p.style.color = styles[0]; p.style.background = styles[1]; p.style.borderColor = styles[2];
  document.querySelectorAll("[data-section]").forEach(e => e.classList.toggle("section-hidden", !state.sections[e.dataset.section]));
  // The rows/blocks below are "optional detail" fields (each has its own
  // on/off switch in the section settings, toggled above via section-hidden
  // — that's a deliberate choice and hides on screen too). Separately from
  // that, if the section is ON but nothing was actually typed in, the row
  // still shows on screen (with its placeholder, e.g. "—" / "Add value") so
  // the person can see it's available to fill in — it only disappears from
  // the printed/PDF "final" invoice, via the print-only .print-hide-empty
  // rule in print.css.
  const notesSection = document.querySelector('[data-section="notes"]');
  const termsSection = document.querySelector('[data-section="terms"]');
  if (notesSection) notesSection.classList.toggle("print-hide-empty", !notesText);
  if (termsSection) termsSection.classList.toggle("print-hide-empty", !termsText);
  const paymentSection = document.querySelector('[data-section="payment"]');
  const paymentText = $("paymentDetails").value.trim();
  if (paymentSection) paymentSection.classList.toggle("print-hide-empty", !paymentText);
  const referenceSection = document.querySelector('[data-section="reference"]');
  if (referenceSection) referenceSection.classList.toggle("print-hide-empty", !referenceText);
  const invoiceDateSection = document.querySelector('[data-section="invoiceDate"]');
  const dueDateSection = document.querySelector('[data-section="dueDate"]');
  if (invoiceDateSection) invoiceDateSection.classList.toggle("print-hide-empty", !invoiceDateVal);
  if (dueDateSection) dueDateSection.classList.toggle("print-hide-empty", !dueDateVal);

  let visible = state.columns.filter(c => c.visible);
  { let raw = visible.map(c => Math.max(5, num(c.width))), sum = raw.reduce((a, b) => a + b, 0) || 1; $("pCols").innerHTML = raw.map(w => `<col style="width:${(w / sum * 100).toFixed(2)}%">`).join(""); }
  $("pHeaders").innerHTML = visible.map(c => `<th class="${alignClass(c.align)}"><span class="col-label-text">${esc(c.label)}</span></th>`).join("");

  let body = $("pItems"); body.innerHTML = "";
  if (!state.items.length) {
    body.innerHTML = `<tr><td class="empty" colspan="${Math.max(1, visible.length)}">No line items added.</td></tr>`;
  } else {
    state.items.forEach((item) => {
      let tr = document.createElement("tr");
      tr.className = "inv-item-row";
      tr.innerHTML = visible.map(c => `<td class="${alignClass(c.align)}">${fmtCell(itemValue(item, c), c)}</td>`).join("");
      body.appendChild(tr);
    });
  }

  let t = calc();
  setText($("pSubtotal"), money(t.subtotal));
  setText($("discountLabel"), `Discount (${pct(t.dr)}%)`);
  setText($("pDiscount"), "−" + money(t.disc));
  setText($("taxLabel"), `Tax (${pct(t.tr)}%)`);
  setText($("pTax"), money(t.tax));
  setText($("pShipping"), money(t.ship));
  setText($("pTotal"), money(t.total)); setText($("pBalance"), money(t.total));
  $("discountRow").classList.toggle("print-hide-empty", !t.disc);
  $("taxRow").classList.toggle("print-hide-empty", !t.tax);
  $("shippingRow").classList.toggle("print-hide-empty", !t.ship);
  $("pLogoFallback").textContent = ($("companyName").value.trim()[0] || "I").toUpperCase();
  let img = $("pLogo"), box = img.closest(".logobox");
  const logoSize = Math.max(24, Math.min(160, num($("logoHeight").value) || 48));
  inv.style.setProperty("--logo-h", logoSize + "px");
  $("logoHeightValue").textContent = logoSize;
  if (state.logo) {
    img.src = state.logo; box.classList.add("has-logo");
  } else {
    img.removeAttribute("src"); box.classList.remove("has-logo");
  }
  fitInvoiceCanvas();
}

function pct(n) { return n.toFixed(2).replace(/\.00$/, ""); }

// Print (see print.js) temporarily resizes .canvaswrap to its natural,
// unscaled size right before calling window.print(). That resize is itself
// observed by the ResizeObserver in main.js, which calls fitInvoiceCanvas()
// again — and without this guard, that re-entrant call would immediately
// re-apply the on-screen "shrink to fit the panel" transform, scaling the
// invoice back down right as the print dialog opens. The physical page
// still prints at full size, so the result is a full-size blank page with
// the shrunk invoice floating in the top-left corner. print.js sets this
// flag for the duration of the print flow so fitInvoiceCanvas() becomes a
// no-op until it's done.
let printGuard = false;
export function setPrintGuard(v) { printGuard = v; }

const MM_TO_PX = 96 / 25.4;

let printWrapCtx = null;

// Restructures .invoice's print output into a native HTML table with a
// repeating <thead> (an empty top-margin spacer) and a repeating <tfoot>
// (the footer). This is what actually guarantees correctness (no overlap,
// no white gaps, and — as of the fix this comment describes — no missing
// top margin or squished-looking footer on any page but the first/last)
// — table-header-group/table-footer-group are plain CSS2.1 table-layout
// features: the browser itself reserves both elements' space on every
// single printed page as part of laying the table out, the same
// well-supported way a <thead> already repeats on every page above the
// items table. Both insets used to just be .invoice's own padding-top/
// padding-bottom, which looks right for a single-page invoice but is
// wrong for a multi-page one: a plain block box's own padding-top and
// padding-bottom only ever render once each when that box is split across
// printed pages — top on page 1, bottom on the final page — never
// repeated on the pages between them, and (worse) not even both on the
// *same* page unless that page happens to be both the first and the last.
// That's exactly the bug this fixes: page 2+ had no top margin at all
// (nothing repeated it there), and the footer had no reserved gap below
// it down to the physical page edge on any page but the last (nothing
// repeated .invoice's padding-bottom there either), making it look
// squished flush against the paper edge. Moving both insets into the
// table itself — a spacer thead and extra padding on the tfoot cell —
// makes them real per-page-repeating content instead of a whole-box
// padding, so every page gets an identical, correct top and bottom inset.
// No prediction of any kind is involved, which matters
// because two earlier versions of this file predicted page breaks in JS
// before printing (to get a colored top margin and a footer that could
// repeat without needing @page margin-box support) and neither prediction
// held up under real printing — one undercounted pages outright, the other
// let real content run into the footer's reserved space and overlap it.
// A later version used a real @page margin + margin box instead, which
// fixed the overlap but is always plain white — a real @page margin is
// physically outside the content box, so no element's background can ever
// reach into it, in any browser. This has neither problem: the reserved
// space is both guaranteed *and* real in-flow content, so it's painted in
// whatever background color the current template uses. The trade-off this
// time is losing the live "Page X of Y" per-page counter — a repeating
// <tfoot> is one DOM node the browser repeats verbatim, so unlike a
// @page margin box's counter(page)/counter(pages) it can't show a
// different number on each page. The footer instead shows the invoice
// number and, for multi-page invoices, a best-effort total page count.
// Works identically in every browser, including Firefox (this is much
// older, better-supported CSS than @page margin boxes).
// Call right before print/PDF export; undo with clearPrintTableWrap().
export function applyPrintTableWrap() {
  const inv = $("invoice");
  if (!inv) return;
  const footer = inv.querySelector(":scope > .footer");
  const originalChildren = Array.from(inv.children);
  const tpl = $("template") ? $("template").value : "modern";
  const pad = templatePaddingMm(tpl);

  const table = document.createElement("table");
  table.className = "print-pagewrap";

  // Repeating top-margin spacer: a <thead> with a single empty cell sized
  // to this template's own top padding. table-header-group repeats it on
  // every printed page — the same native, guaranteed mechanism the tfoot
  // below uses for the bottom — which is what makes the top inset show up
  // on page 2+ too, not just page 1. See templatePaddingMm() in state.js
  // for why this can't just be .invoice's own padding-top.
  const thead = document.createElement("thead");
  const theadTr = document.createElement("tr");
  const theadTd = document.createElement("td");
  theadTd.style.height = pad.top + "mm";
  theadTr.appendChild(theadTd);
  thead.appendChild(theadTr);

  const tbody = document.createElement("tbody");
  const tbodyTr = document.createElement("tr");
  const tbodyTd = document.createElement("td");
  tbodyTr.appendChild(tbodyTd);
  tbody.appendChild(tbodyTr);

  const tfoot = document.createElement("tfoot");
  const tfootTr = document.createElement("tr");
  const tfootTd = document.createElement("td");
  // Extra space *below* the footer clone, down to the physical page edge —
  // the print equivalent of the on-screen footer's own "bottom: Xmm" inset
  // (templateFooterInsetMm's .bottom value; that's exactly this template's
  // bottom padding minus 2mm). Without this the footer clone would sit
  // flush against the page's true bottom edge on every page, which is the
  // "footer looks cut off" symptom — there was nothing reserving the small
  // gap below it that the on-screen design always has.
  tfootTd.style.paddingBottom = templateFooterInsetMm(tpl).bottom + "mm";
  tfootTr.appendChild(tfootTd);
  tfoot.appendChild(tfootTr);

  // Move every real child except the footer into the tbody cell, in their
  // original order — appendChild on a node already in the document moves
  // it rather than duplicating it, so this is a true move, not a clone.
  originalChildren.forEach(child => {
    if (child !== footer) tbodyTd.appendChild(child);
  });

  // The footer itself is cloned into the tfoot cell — the original stays
  // put in .invoice, just hidden, so restoring it in clearPrintTableWrap()
  // is a matter of showing it again, not reconstructing it from scratch.
  // The position/inset overrides below are set inline (redundant with the
  // .footer-print-clone rule in print.css, which also sets them) rather
  // than relying on that stylesheet rule alone, because this function runs
  // under normal screen layout, before print media is actually active —
  // without the inline overrides, the clone would keep the base .footer
  // rule's position:absolute at the point offsetHeight is read below,
  // which pulls it out of tfootTd's normal flow entirely and makes it
  // measure as ~0, undercounting the real space the footer needs on every
  // page by nearly its full height.
  let footerClone = null;
  if (footer && !footer.classList.contains("section-hidden")) {
    footerClone = footer.cloneNode(true);
    footerClone.removeAttribute("id");
    footerClone.classList.add("footer-print-clone");
    footerClone.style.position = "static";
    footerClone.style.left = "auto";
    footerClone.style.right = "auto";
    footerClone.style.bottom = "auto";
    footerClone.style.margin = "0";
    footerClone.style.padding = "8px 0 0";
    footerClone.style.borderTop = "1px solid #e4e7ec";
    footerClone.style.boxSizing = "border-box";
    tfootTd.appendChild(footerClone);
  }
  if (footer) footer.style.display = "none";

  table.appendChild(thead);
  table.appendChild(tbody);
  table.appendChild(tfoot);
  inv.appendChild(table);

  // Background fill: same goal as always (the last page's leftover space,
  // past the end of the real content, should be painted in the template's
  // background color rather than left blank) but the mechanism is simpler
  // now the footer's own reserved space is handled natively above — this
  // only needs a spacer sized so the total content lands on a page
  // boundary.
  //
  // Three repeating elements eat into a page's usable content height: our
  // own top spacer and tfoot (both measured directly above) on *every*
  // page including the first, and the items table's own thead — but only
  // on page 2 onward, since its first appearance is already counted as
  // part of the real content height being measured below (it's the
  // *repeat* on later pages that's "extra", the same way the top spacer or
  // tfoot themselves would be if they weren't already subtracted from
  // every page uniformly). Forgetting a repeating element's cost here is
  // the exact source of a real regression this app has had before: without
  // it the estimate is short by roughly that element's height on every
  // page it repeats on, and that shortfall compounds with page count
  // instead of staying constant — fine-looking on a 2-page invoice, a very
  // visible gap by 4 pages.
  const p = currentPaper();
  const pageHpx = p.h * MM_TO_PX;
  const tfootHpx = tfootTd.offsetHeight;
  const topSpacerHpx = theadTd.offsetHeight;
  const itemsThead = tbodyTd.querySelector(".invtable thead");
  const theadHpx = itemsThead ? itemsThead.offsetHeight : 0;
  // pageCount: a best-effort estimate of how many pages the real content
  // needs, used only to size the min-height stretch below — not to
  // constrain real pagination in any way (that's 100% native: the
  // browser's own break-inside:avoid plus the repeating thead/tfoot above,
  // neither of which reads anything computed here).
  // Both budgets now subtract the top-margin spacer's own height too,
  // since (unlike the old .invoice padding-top it replaces) it's real
  // repeating table content that eats into every single page's usable
  // height, page 1 included — not just pages 2+.
  const safetyPx = 20 * MM_TO_PX;
  const firstBudget = pageHpx - topSpacerHpx - tfootHpx - safetyPx;
  const laterBudget = pageHpx - topSpacerHpx - tfootHpx - theadHpx - safetyPx;
  const contentH = tbodyTd.scrollHeight;
  const cumulative = [];
  let acc = 0, n = 0;
  while (acc < contentH - 0.5 || n === 0) {
    acc += n === 0 ? firstBudget : laterBudget;
    cumulative.push(acc);
    n++;
    if (n > 500) break;   // sane ceiling — guards against an infinite loop if something's off
  }
  const pageCount = cumulative.length;
  // Background fill for the trailing space past the end of real content on
  // the last page: min-height directly on .invoice, nothing more. An
  // earlier version of this also inserted a filler <div> *inside* the
  // table body, sized to make the body's own content reach a full-page
  // multiple on its own — which sounds equivalent but isn't: that div is
  // real content, positioned *before* the tfoot in the table's flow (a
  // repeating tfoot, by construction, always renders after whatever's in
  // the body on a given page), so any error in its size — and given this
  // is an estimate made under normal screen layout before print media is
  // actually active, some error is expected — showed up as a visible gap
  // of blank space *before* the footer instead of after it, on every
  // multi-page invoice, not just an edge case. .invoice itself has no such
  // problem: it's the table's plain block parent, not a participant in the
  // table's own per-page layout, so padding it out with min-height can
  // only ever add space after the table's last real fragment (i.e. after
  // the last page's tfoot) — nowhere else, regardless of how far off the
  // estimate is.
  inv.style.minHeight = ((pageCount * pageHpx) / MM_TO_PX) + "mm";

  // The footer clone's own text: a live per-page counter isn't possible
  // (see the comment above), so this just shows the invoice number, plus a
  // best-effort total page count for multi-page invoices — pageCount here
  // is the same estimate used for the spacer above, good enough for a
  // rough total even on the rare occasion it's not pixel-exact.
  if (footerClone) {
    const invNo = ($("invoiceNumber") && $("invoiceNumber").value.trim()) || "Untitled";
    const invoiceSpan = footerClone.querySelector("#pFooterInvoice");
    if (invoiceSpan) invoiceSpan.textContent = pageCount > 1 ? `Invoice #${invNo}  ·  ${pageCount} pages` : `Invoice #${invNo}`;
  }

  printWrapCtx = { table, footer, originalChildren };
}

export function clearPrintTableWrap() {
  const inv = $("invoice");
  if (!inv || !printWrapCtx) return;
  inv.style.minHeight = "";
  // Re-append every original child in its original order — appendChild on
  // a node that's already in the document moves it back rather than
  // duplicating it, so this fully undoes the move above with nothing left
  // over to clean up on the moved nodes themselves.
  printWrapCtx.originalChildren.forEach(child => inv.appendChild(child));
  if (printWrapCtx.footer) printWrapCtx.footer.style.display = "";
  printWrapCtx.table.remove();
  printWrapCtx = null;
}

export function fitInvoiceCanvas() {
  if (printGuard) return;
  const wrap = document.querySelector(".canvaswrap"), inv = $("invoice");
  if (!wrap || !inv) return;
  const p = currentPaper();
  const naturalW = p.w * 96 / 25.4;   // page width in CSS px at the standard 96dpi
  const naturalH = p.h * 96 / 25.4;   // page height in CSS px
  // Measure against the wrap's own parent, not wrap.clientWidth itself — the
  // wrap's CSS max-width caps it at one natural page width, so at zoom>100%
  // clientWidth would silently cap "available" too, making the scaled
  // invoice wider than its own wrapper. That's what caused zooming in to
  // clip/shift the preview instead of actually showing it larger.
  const panel = wrap.parentElement;
  const available = (panel ? panel.clientWidth : 0) || naturalW;
  const fit = Math.min(1, available / naturalW);   // shrink to fit narrow screens; never auto-enlarge
  const total = fit * state.zoom;
  const scaledW = naturalW * total;
  inv.style.transformOrigin = "top left";
  inv.style.transform = `scale(${total})`;
  wrap.style.maxWidth = "none";   // let the wrapper grow past one page width when zoomed in past 100%
  if (scaledW <= available) {
    // Fits within the panel (includes the shrink-to-fit case on narrow
    // screens): size the wrap to the panel and center the invoice inside it.
    wrap.style.width = available + "px";
    inv.style.marginLeft = ((available - scaledW) / 2) + "px";
  } else {
    // Zoomed in past what the panel can show at once: grow the wrap to
    // match the real (larger) size instead of clipping it — .workspace
    // already scrolls, so this reveals the rest via scrolling, the same way
    // a multi-page invoice already scrolls vertically below.
    wrap.style.width = scaledW + "px";
    inv.style.marginLeft = "0";
  }

  // Multi-page invoices: the invoice box naturally grows taller than one page
  // when content overflows (it uses min-height, not a fixed height), but the
  // wrapper below used to be pinned to exactly one page's height — silently
  // clipping everything past page 1. Measure the real content height, work
  // out how many pages that spans, and size the wrapper (+ draw dashed
  // page-break guides) to match — Print/PDF already paginate correctly on
  // their own, this only affects the on-screen preview.
  const contentH = inv.scrollHeight || naturalH;
  const pageCount = Math.max(1, Math.ceil(contentH / naturalH - 0.01));   // small epsilon avoids a
                                                                            // false "page 2" from
                                                                            // sub-pixel rounding
  renderPageBreaks(inv, naturalH, pageCount);
  wrap.style.height = Math.ceil(pageCount * naturalH * total) + "px";

  // The footer (see .footer in print.css) repeats on every printed page via
  // position:fixed rather than CSS @page margin boxes — reliable cross-browser,
  // but it means there's no per-page "counter(page)" available here the way
  // there would be inside a margin box, so this shows the total page count
  // instead of a live "page X of Y" (still useful, and correct everywhere,
  // including Firefox, where margin-box content isn't supported at all).
  const footerInvoiceEl = $("pFooterInvoice");
  if (footerInvoiceEl) {
    const invNo = ($("invoiceNumber") && $("invoiceNumber").value.trim()) || "Untitled";
    footerInvoiceEl.textContent = "Invoice #" + invNo + (pageCount > 1 ? `  ·  ${pageCount} pages` : "");
  }

  $("zoomLabel").textContent = Math.round(state.zoom * 100) + "%";
  const meta = $("previewMeta");
  if (meta) {
    const sizeName = p.pdfName === "LETTER" ? "US Letter" : "A4";
    meta.textContent = `${sizeName} portrait preview` + (pageCount > 1 ? ` · ${pageCount} pages` : "");
  }
}

function renderPageBreaks(inv, naturalH, pageCount) {
  inv.querySelectorAll(".page-break-line,.page-break-chip").forEach(el => el.remove());
  for (let i = 1; i < pageCount; i++) {
    const y = naturalH * i;
    const line = document.createElement("div");
    line.className = "page-break-line";
    line.style.top = y + "px";
    inv.appendChild(line);
    const chip = document.createElement("div");
    chip.className = "page-break-chip";
    chip.style.top = y + "px";
    chip.textContent = `Page ${i + 1}`;
    inv.appendChild(chip);
  }
}

// Each line of the company/client "meta" blocks (registration, VAT, address,
// phone, email, website / contact, VAT, address, email) is its own row in
// the preview, sourced from the matching Details-tab field. A row with no
// value renders empty and gets .print-hide-empty so blank rows never
// appear in Preview mode or the printed/PDF output (see setText()'s sibling
// note above for why Draft mode still shows them).
function setMetaField(el, value, prefix) {
  if (!el) return;
  setText(el, value ? prefix + value : "");
  el.classList.toggle("print-hide-empty", !value);
}
