// preview.js — renders the live invoice document (the on-screen A4/Letter canvas).

import { $, esc } from "./dom.js";
import { state, currentPaper, applyPaperSize, templateFooterInsetMm } from "./state.js";
import { money, dateFmt, alignClass, fmtCell, num } from "./format.js";
import { calc, itemValue } from "./calc.js";
import { applyAllOptionalColors } from "./accent.js";

export function renderPreview() {
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
  const labels = { title: "INVOICE", bill: "Bill to", status: "Invoice status", balance: "Balance due", note: "Invoice note", payment: "Payment details", terms: "Terms", date: "Invoice date", due: "Due date", ref: "Reference" };
  $("pInvoiceTitle").textContent = labels.title;
  $("pBillToLabel").textContent = labels.bill;
  $("pBalanceLabel").textContent = labels.balance;
  $("pNoteLabel").textContent = labels.note;
  $("pPaymentLabel").textContent = labels.payment;
  $("pTermsLabel").textContent = labels.terms;
  const metaLabels = document.querySelectorAll(".metatable td:first-child");
  if (metaLabels[0]) metaLabels[0].textContent = labels.date;
  if (metaLabels[1]) metaLabels[1].textContent = labels.due;
  if (metaLabels[2]) metaLabels[2].textContent = labels.ref;
  $("pCompanyName").textContent = $("companyName").value.trim() || "Your Company"; $("pCompanyMeta").textContent = metaCompany();
  let no = $("invoiceNumber").value.trim() || "Untitled"; $("pInvoiceNo").textContent = "#" + no; $("pDate").textContent = dateFmt($("invoiceDate").value); $("pDue").textContent = dateFmt($("dueDate").value); $("pReference").textContent = $("reference").value.trim() || "—";
  $("pClientName").textContent = $("clientName").value.trim() || "Client company"; $("pClientMeta").textContent = metaClient();
  const notesText = $("notes").value.trim();
  const termsText = $("terms").value.trim();
  $("pNotes").textContent = notesText;
  $("pPayment").textContent = $("paymentDetails").value.trim();
  $("pTerms").textContent = termsText;
  $("pFooterCompany").textContent = $("companyName").value.trim() || "Your Company"; $("pFooterInvoice").textContent = "Invoice #" + no;
  let status = $("status").value, p = $("pStatus"), styles = { Draft: ["#475467", "#f2f4f7", "#d0d5dd"], Due: ["#18794e", "#ecfdf3", "#abefc6"], Paid: ["#175cd3", "#eff8ff", "#b2ddff"], "Partially Paid": ["#9a6700", "#fffaeb", "#fedf89"], Overdue: ["#b42318", "#fef3f2", "#fecdca"], Canceled: ["#667085", "#f2f4f7", "#d0d5dd"] }[status] || ["#475467", "#f2f4f7", "#d0d5dd"]; p.textContent = "● " + status; p.style.color = styles[0]; p.style.background = styles[1]; p.style.borderColor = styles[2];
  document.querySelectorAll("[data-section]").forEach(e => e.classList.toggle("section-hidden", !state.sections[e.dataset.section]));
  const notesSection = document.querySelector('[data-section="notes"]');
  const termsSection = document.querySelector('[data-section="terms"]');
  if (notesSection) notesSection.classList.toggle("section-hidden", !state.sections.notes || !notesText);
  if (termsSection) termsSection.classList.toggle("section-hidden", !state.sections.terms || !termsText);
  const paymentSection = document.querySelector('[data-section="payment"]');
  const paymentText = $("paymentDetails").value.trim();
  if (paymentSection) paymentSection.classList.toggle("section-hidden", !state.sections.payment || !paymentText);
  let visible = state.columns.filter(c => c.visible);
  { let raw = visible.map(c => Math.max(5, num(c.width))), sum = raw.reduce((a, b) => a + b, 0) || 1; $("pCols").innerHTML = raw.map(w => `<col style="width:${(w / sum * 100).toFixed(2)}%">`).join(""); }
  $("pHeaders").innerHTML = visible.map(c => `<th class="${alignClass(c.align)}">${esc(c.label)}</th>`).join("");
  let body = $("pItems"); body.innerHTML = ""; if (!state.items.length) body.innerHTML = `<tr><td class="empty" colspan="${Math.max(1, visible.length)}">No line items added.</td></tr>`; else state.items.forEach(item => { let tr = document.createElement("tr"); tr.innerHTML = visible.map(c => `<td class="${alignClass(c.align)}">${fmtCell(itemValue(item, c), c)}</td>`).join(""); body.appendChild(tr); });
  let t = calc(); $("pSubtotal").textContent = money(t.subtotal); $("discountLabel").textContent = `Discount (${t.dr.toFixed(2).replace(/\.00$/, "")}%)`; $("pDiscount").textContent = "−" + money(t.disc); $("taxLabel").textContent = `Tax (${t.tr.toFixed(2).replace(/\.00$/, "")}%)`; $("pTax").textContent = money(t.tax); $("pShipping").textContent = money(t.ship); $("pTotal").textContent = $("pBalance").textContent = money(t.total);
  $("discountRow").style.display = t.disc && state.sections.discount ? "flex" : "none"; $("taxRow").style.display = t.tax && state.sections.tax ? "flex" : "none"; $("shippingRow").style.display = t.ship && state.sections.shipping ? "flex" : "none";
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

export function fitInvoiceCanvas() {
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

function metaCompany() {
  let a = [];
  if ($("companyReg").value.trim()) a.push("Registration: " + $("companyReg").value.trim());
  if ($("companyVat").value.trim()) a.push("VAT / Tax: " + $("companyVat").value.trim());
  if ($("companyAddress").value.trim()) a.push($("companyAddress").value.trim());
  if ($("companyPhone").value.trim()) a.push("Phone: " + $("companyPhone").value.trim());
  if ($("companyEmail").value.trim()) a.push("Email: " + $("companyEmail").value.trim());
  if ($("companyWebsite").value.trim()) a.push($("companyWebsite").value.trim());
  return a.join("\n") || "Add your company details";
}

function metaClient() {
  let a = [];
  if ($("clientContact").value.trim()) a.push($("clientContact").value.trim());
  if ($("clientTax").value.trim()) a.push("VAT / Tax: " + $("clientTax").value.trim());
  if ($("clientAddress").value.trim()) a.push($("clientAddress").value.trim());
  if ($("clientEmail").value.trim()) a.push($("clientEmail").value.trim());
  return a.join("\n") || "Add client details";
}
