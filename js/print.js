// print.js — prints the invoice using the browser's own native print dialog,
// directly on the live #invoice element (styled by print.css). No PDF
// library, no new tab: this opens the print dialog immediately, the same
// way pressing Ctrl/Cmd+P on any web page would.

import { $ } from "./dom.js";
import { applyPaperSize } from "./state.js";
import { setPrintGuard, fitInvoiceCanvas, applyPrintTableWrap, clearPrintTableWrap } from "./preview.js";

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
  // Stop fitInvoiceCanvas() from reacting to the .canvaswrap resize below —
  // see the comment on setPrintGuard/fitInvoiceCanvas in preview.js. Without
  // this, the ResizeObserver in main.js re-applies the on-screen "shrink to
  // fit panel" transform right as the print dialog opens, so the printed
  // page comes out full-size but with the invoice shrunk into a corner.
  setPrintGuard(true);
  // The on-screen invoice is shown at a zoomed/fit-to-panel scale (see
  // fitInvoiceCanvas in preview.js) — above 100% zoom that also widens
  // .canvaswrap itself (so the zoomed page isn't clipped on screen) — print.css
  // prints the invoice full-size regardless, so this neutralizes all of that
  // just for the print, then restores the real preview afterward.
  invoice.style.transform = "none";
  invoice.style.marginLeft = "0";
  if (wrap) { wrap.style.height = "auto"; wrap.style.width = "auto"; wrap.style.maxWidth = "none"; }
  applyPaperSize();
  // Must run after the transform/wrap reset above (needs the invoice at its
  // real, unscaled height to measure correctly) — see applyPrintTableWrap
  // in preview.js for why this exists.
  applyPrintTableWrap();

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    window.removeEventListener("afterprint", restore);
    window.removeEventListener("focus", restore);
    invoice.style.transform = oldTransform;
    invoice.style.marginLeft = oldMarginLeft;
    if (wrap) { wrap.style.height = oldWrapHeight; wrap.style.width = oldWrapWidth; wrap.style.maxWidth = oldWrapMaxWidth; }
    document.title = oldTitle;
    clearPrintTableWrap();
    setPrintGuard(false);
    fitInvoiceCanvas();   // re-fit the real on-screen preview now that the guard is off
  };
  // afterprint fires once the print dialog actually closes, in every
  // browser that supports it — the primary restore trigger. window
  // refocusing is a second, independent signal: native print/save dialogs
  // steal focus while open and hand it back the moment they close, so this
  // catches browsers/cases where afterprint is unreliable without waiting
  // on a timer. The setTimeout below is now a last-resort safety net only,
  // deliberately generous (a real person choosing a printer, or a save
  // location for "Save as PDF", can easily take longer than a couple of
  // seconds) — it used to be 1000ms on the assumption that window.print()
  // blocks the script until the dialog closes, so nothing downstream could
  // run early. That assumption doesn't hold in every browser, and where it
  // doesn't, the 1000ms fallback was firing *while the dialog was still
  // open*, silently undoing the unscaled size, the real page dimensions,
  // and the whole print table-wrap (see applyPrintTableWrap in preview.js)
  // before the browser had actually finished capturing the output — every
  // symptom of this file's early bugs (shrunk-down output, missing
  // footer) with none of the code actually being wrong.
  window.addEventListener("afterprint", restore);

  // Two animation frames + a short delay gives the browser time to fully
  // reflow with the reset styles above and the print stylesheet before the
  // dialog opens — one frame is enough in Chrome, but Firefox can otherwise
  // open the print dialog against a stale layout (still mid-transform/mid
  // old-size), which is a likely source of Firefox-only print glitches.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();
      // Only listen for refocus *after* print() is actually called — a
      // window blur/focus cycle from something unrelated during the setup
      // delay above would otherwise risk triggering restore() before the
      // dialog even opened.
      window.addEventListener("focus", restore);
      setTimeout(restore, 30000);
    }, 60);
  }));
}
