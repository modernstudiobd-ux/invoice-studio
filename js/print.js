// print.js — prints the invoice using the browser's own native print dialog,
// directly on the live #invoice element (styled by print.css). No PDF
// library, no new tab: this opens the print dialog immediately, the same
// way pressing Ctrl/Cmd+P on any web page would.

import { $ } from "./dom.js";
import { applyPaperSize } from "./state.js";

export function printInvoice(suggestedName) {
  const invoice = $("invoice");
  const wrap = document.querySelector(".canvaswrap");
  const oldTitle = document.title;
  const oldTransform = invoice.style.transform;
  const oldMarginLeft = invoice.style.marginLeft;
  const oldWrapHeight = wrap ? wrap.style.height : "";
  const oldWrapWidth = wrap ? wrap.style.width : "";
  const oldWrapMaxWidth = wrap ? wrap.style.maxWidth : "";
  // document.title becomes the print dialog's/PDF's suggested filename in
  // most browsers when printing or choosing "Save as PDF" as the destination.
  if (suggestedName) document.title = suggestedName;
  // The on-screen invoice is shown at a zoomed/fit-to-panel scale (see
  // fitInvoiceCanvas in preview.js) — above 100% zoom that also widens
  // .canvaswrap itself (so the zoomed page isn't clipped on screen) — print.css
  // prints the invoice full-size regardless, so this neutralizes all of that
  // just for the print, then restores the real preview afterward.
  invoice.style.transform = "none";
  invoice.style.marginLeft = "0";
  if (wrap) { wrap.style.height = "auto"; wrap.style.width = "auto"; wrap.style.maxWidth = "none"; }
  applyPaperSize();   // refreshes the @page footer's page count right before printing
  // Two animation frames + a short delay gives the browser time to fully
  // reflow with the reset styles above and the print stylesheet before the
  // dialog opens — one frame is enough in Chrome, but Firefox can otherwise
  // open the print dialog against a stale layout (still mid-transform/mid
  // old-size), which is a likely source of Firefox-only print glitches.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        invoice.style.transform = oldTransform;
        invoice.style.marginLeft = oldMarginLeft;
        if (wrap) { wrap.style.height = oldWrapHeight; wrap.style.width = oldWrapWidth; wrap.style.maxWidth = oldWrapMaxWidth; }
        document.title = oldTitle;
      }, 250);
    }, 60);
  }));
}
