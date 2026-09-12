// layout.js — all the "app chrome" wiring: resizable sidebar, desktop tabs,
// mobile edit/preview switcher + drawer + fullscreen preview, and the phone
// bottom-bar "more actions" popover. No invoice business logic.

import { $ } from "./dom.js";
import { renderPreview } from "./preview.js";
import { closeColSettings } from "./columnCanvas.js";

const sidebarResizer = $("sidebarResizer"), appRoot = $("appRoot");
let resizingSidebar = false;
const savedSidebarWidth = Number(localStorage.getItem("invoiceStudio.sidebarWidth"));
if (savedSidebarWidth >= 260 && savedSidebarWidth <= 720) {
  document.documentElement.style.setProperty("--sidebar-width", savedSidebarWidth + "px");
}
sidebarResizer.addEventListener("mousedown", e => {
  if (window.innerWidth <= 1180) return;
  resizingSidebar = true;
  document.body.classList.add("resizing-sidebar");
  sidebarResizer.classList.add("dragging");
  e.preventDefault();
});
window.addEventListener("mousemove", e => {
  if (!resizingSidebar) return;
  const width = Math.max(260, Math.min(720, e.clientX));
  document.documentElement.style.setProperty("--sidebar-width", width + "px");
  localStorage.setItem("invoiceStudio.sidebarWidth", String(width));
});
window.addEventListener("mouseup", () => {
  if (!resizingSidebar) return;
  resizingSidebar = false;
  document.body.classList.remove("resizing-sidebar");
  sidebarResizer.classList.remove("dragging");
});
sidebarResizer.addEventListener("dblclick", () => {
  document.documentElement.style.setProperty("--sidebar-width", "300px");
  localStorage.setItem("invoiceStudio.sidebarWidth", "300");
});

const mvEditBtn = $("mvEditBtn"), mvPreviewBtn = $("mvPreviewBtn");
export function setMobileView(view) {
  appRoot.classList.toggle("view-edit", view === "edit");
  appRoot.classList.toggle("view-preview", view === "preview");
  mvEditBtn.classList.toggle("active", view === "edit");
  mvPreviewBtn.classList.toggle("active", view === "preview");
  mvEditBtn.setAttribute("aria-selected", view === "edit" ? "true" : "false");
  mvPreviewBtn.setAttribute("aria-selected", view === "preview" ? "true" : "false");
}
mvEditBtn.addEventListener("click", () => setMobileView("edit"));
mvPreviewBtn.addEventListener("click", () => setMobileView("preview"));
setMobileView("edit");

// Sidebar tab strip (Design/Table Columns/Items) has been removed — Design
// is the only sidebar section left, so there's nothing left to switch
// between there. The hamburger drawer's "Design" item below still exists
// (it also holds the "Invoice actions" shortcuts on phone), it just no
// longer needs to activate a tab — only to switch the phone Form/Preview
// view and close itself.

/* --- Mobile chrome (additive UI-only wiring; no business logic here) --- */

// Hamburger drawer: on phone, opens the sidebar's Design section + the
// Invoice actions shortcuts (Save/Duplicate/History/New invoice — see
// #invoiceToolbarSlot below).
const hamburgerBtn = $("hamburgerBtn"), mobileDrawer = $("mobileDrawer"), drawerOverlay = $("drawerOverlay"), drawerCloseBtn = $("drawerCloseBtn");
const drawerItems = Array.from(document.querySelectorAll(".drawer-item"));
function openDrawer() { mobileDrawer.classList.add("open"); drawerOverlay.classList.add("show"); mobileDrawer.setAttribute("aria-hidden", "false"); hamburgerBtn.setAttribute("aria-expanded", "true"); }
function closeDrawer() { mobileDrawer.classList.remove("open"); drawerOverlay.classList.remove("show"); mobileDrawer.setAttribute("aria-hidden", "true"); hamburgerBtn.setAttribute("aria-expanded", "false"); }
hamburgerBtn.addEventListener("click", openDrawer);
drawerCloseBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
drawerItems.forEach(btn => btn.addEventListener("click", () => {
  drawerItems.forEach(x => x.classList.toggle("active", x === btn));
  setMobileView("edit");
  closeDrawer();
}));

// Invoice actions (Save / Duplicate / History / New invoice): on phone widths
// these move into the hamburger drawer instead of sitting in a row above the
// preview, where they wrapped onto multiple lines and ate vertical space.
// Desktop/tablet keep the original row above the canvas, untouched.
const invoiceToolbar = $("invoiceToolbar"), invoiceToolbarAnchor = $("invoiceToolbarAnchor"), invoiceToolbarSlot = $("invoiceToolbarSlot");
const phoneQuery = window.matchMedia("(max-width:640px)");
function placeInvoiceToolbar(isPhone) {
  if (isPhone) invoiceToolbarSlot.appendChild(invoiceToolbar);
  else invoiceToolbarAnchor.after(invoiceToolbar);
}
placeInvoiceToolbar(phoneQuery.matches);
phoneQuery.addEventListener("change", e => placeInvoiceToolbar(e.matches));

// Tapping Save/Duplicate/New invoice inside the drawer should feel like a
// normal menu action: perform it, then dismiss the drawer.
["saveInvoiceBtn", "duplicateInvoiceBtn", "newInvoiceBtn", "saveTemplateBtn"].forEach(id => {
  $(id).addEventListener("click", () => { if (phoneQuery.matches) closeDrawer(); });
});

// Fullscreen preview: hides all mobile chrome and gives the invoice the full viewport.
const expandPreviewBtn = $("expandPreviewBtn"), exitFullscreenBtn = $("exitFullscreenBtn");
function setFullscreenPreview(on) {
  document.body.classList.toggle("fullscreen-preview", on);
  if (on) setMobileView("preview");
  fitInvoiceCanvas();
}
expandPreviewBtn.addEventListener("click", () => setFullscreenPreview(true));
exitFullscreenBtn.addEventListener("click", () => setFullscreenPreview(false));

// Edit / Preview canvas switch — "Edit" (default) shows every optional
// field/row even when left blank (see the placeholder text preview.js
// renders for them, e.g. "—" / "Add value"), so it's clear what's
// available to fill in on the Details tab; "Preview" hides those empty
// optional rows via the .canvas-preview-mode rule in invoice.css — the
// same .print-hide-empty class @media print already uses — so it's a
// faithful, live dry run of the actual Print/PDF output, not a separate
// approximation of it. That includes being genuinely non-editable, the
// same way a real print preview is: setCanvasEditable() below locks every
// real field living directly on the document (see setInvoiceFieldsEditable)
// the instant Preview turns on, and unlocks them the instant Edit
// returns — editing still happens freely through the left sidebar's Design
// tools and the Right Sidebar's Page setup/Alignment/Template/Currency,
// none of which are part of the document itself.
const canvasModeEditBtn = $("canvasModeEditBtn"), canvasModePreviewBtn = $("canvasModePreviewBtn");

// Locks/unlocks every real form field living on the invoice document
// itself (company/client details, dates, notes/terms/payment, discount/
// tax/shipping, the status badge, the logo controls) — everything
// index.html and state.js call "fields", i.e. the document's own content,
// as opposed to the sidebar tools that manage it. readOnly covers
// text-like inputs/textareas (keeps them focusable/selectable for copying,
// just not editable, and is announced correctly by screen readers);
// disabled covers <select> and the logo's range/file/checkbox-style
// controls, which don't support readOnly at all. Blurring first stops a
// field the person was actively typing in from being yanked read-only out
// from under a live caret.
function setInvoiceFieldsEditable(editable) {
  const inv = $("invoice");
  if (!inv) return;
  if (!editable && inv.contains(document.activeElement)) document.activeElement.blur();
  inv.querySelectorAll("input, textarea").forEach(el => { el.readOnly = !editable; });
  inv.querySelectorAll("select").forEach(el => { el.disabled = !editable; });
}

export function setCanvasMode(mode) {
  const isPreview = mode === "preview";
  document.body.classList.toggle("canvas-preview-mode", isPreview);
  canvasModeEditBtn.classList.toggle("active", !isPreview);
  canvasModeEditBtn.setAttribute("aria-selected", String(!isPreview));
  canvasModePreviewBtn.classList.toggle("active", isPreview);
  canvasModePreviewBtn.setAttribute("aria-selected", String(isPreview));
  // Column editing (the per-header "⋮" popover) only makes sense in Edit
  // mode — Preview shows the read-only, faithful dry run of the printed
  // document, so close it the instant Preview turns on rather than leaving
  // it floating over a now-uneditable table.
  if (isPreview) closeColSettings();
  // Edit and Preview also render the line-items table differently (real
  // <input>s + a remove column vs. plain formatted text — see preview.js),
  // on top of sizing the canvas wrapper differently (auto-height form vs.
  // fixed page multiples). renderPreview() rebuilds both and ends by
  // calling fitInvoiceCanvas() itself, so it fully replaces the narrower
  // fitInvoiceCanvas()-only call this used to make.
  renderPreview();
  setInvoiceFieldsEditable(!isPreview);
}
canvasModeEditBtn.addEventListener("click", () => setCanvasMode("edit"));
canvasModePreviewBtn.addEventListener("click", () => setCanvasMode("preview"));

// Bottom-bar "more actions" popover — same Export/Import/Reset buttons, just tucked away on phone.
const actionsMoreBtn = $("actionsMoreBtn"), actionsMorePanel = $("actionsMorePanel");
function closeActionsMore() { actionsMorePanel.classList.remove("open"); actionsMoreBtn.setAttribute("aria-expanded", "false"); }
actionsMoreBtn.addEventListener("click", e => {
  e.stopPropagation();
  const open = actionsMorePanel.classList.toggle("open");
  actionsMoreBtn.setAttribute("aria-expanded", open ? "true" : "false");
});
// composedPath() reflects the click's path at dispatch time, which stays
// accurate even if the click handler itself re-renders/replaces the clicked
// element (as History's Rename does) before this listener runs — .contains()
// would wrongly say "outside" in that case, since the original node is gone.
document.addEventListener("click", e => { const path = e.composedPath(); if (!path.includes(actionsMorePanel) && !path.includes(actionsMoreBtn)) closeActionsMore(); });
actionsMorePanel.querySelectorAll("button").forEach(b => b.addEventListener("click", closeActionsMore));

// Saved-invoices "History" dropdown, positioned above the preview alongside
// Save/Duplicate/New invoice (replaces the old sidebar History tab).
const historyToggleBtn = $("historyToggleBtn"), historyPanel = $("historyPanel");

// Anchors a .history-panel below its toggle button using fixed positioning
// computed from the button's actual on-screen position, instead of relying
// on CSS position:absolute (which was getting clipped by .toolbar-row's
// overflow-x:auto — see the comment on .history-panel in base.css). The
// panel itself always lives in #floatingLayer, a direct child of <body>
// with no transformed ancestor, so these viewport-relative coordinates
// always land correctly — see the comment on #floatingLayer in index.html.
// On phone widths the panel is centered via its own CSS media query
// instead, so any inline position from a previous desktop placement is
// cleared.
//
// max-height is set here too, computed from the *actual* remaining space
// between the panel and the nearest viewport edge — not a flat CSS value —
// so a panel can never render partly past the bottom (or top) of the
// screen with no way to scroll the hidden part into view. That used to
// happen with the CSV/Excel import tutorial: opening its <details> grows
// the panel's content after this function had already run once, and a
// static "max-height:70vh" doesn't know where the panel's top edge is, so
// it could still push the bottom of the panel off-screen even though the
// panel's own overflow:auto had nothing to scroll (the content fit inside
// 70vh, just not inside the space actually left below the panel's top).
// Re-running this function (see the "toggle" listener on .importhelp
// below) re-measures both the flip decision and the max-height against
// real, current space, so the fix holds regardless of window size or how
// much the tutorial content grows.
function positionDropdownPanel(panel, toggleBtn, maxWidth = 360) {
  if (phoneQuery.matches) {
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.left = "";
    panel.style.width = "";
    panel.style.maxHeight = "";
    return;
  }
  const r = toggleBtn.getBoundingClientRect();
  const width = Math.min(maxWidth, window.innerWidth - 32);
  let left = r.left + r.width / 2 - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  panel.style.width = width + "px";
  panel.style.left = left + "px";
  // Prefer opening below the button; flip above it when there isn't enough
  // room underneath (e.g. the toolbar sits near the bottom of a short
  // window) so the panel never renders partly off the bottom edge.
  const gap = 8, minHeight = 160;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const openAbove = spaceBelow < minHeight && spaceAbove > spaceBelow;
  if (openAbove) {
    // Anchored by "bottom" (distance from the viewport's bottom edge) so
    // the panel's own top always lands exactly at spaceAbove regardless of
    // its real height — no need to predict that height up front.
    panel.style.top = "";
    panel.style.bottom = (window.innerHeight - r.top + gap) + "px";
    panel.style.maxHeight = Math.max(minHeight, spaceAbove) + "px";
  } else {
    panel.style.bottom = "";
    panel.style.top = (r.bottom + gap) + "px";
    panel.style.maxHeight = Math.max(minHeight, spaceBelow) + "px";
  }
}
// Horizontally scrolling the toolbar row, or resizing the window, would
// leave an already-open panel visually anchored to where its button used
// to be, so just close it — simpler and safer than recomputing position
// continuously on scroll/resize.
const toolbarRowEl = document.querySelector(".toolbar-row");
function closeAllFloatingPanels() { closeHistoryPanel(); closeTemplatesPanel(); closeImportPanel(); closeLogoSettingsPanel(); }
if (toolbarRowEl) toolbarRowEl.addEventListener("scroll", closeAllFloatingPanels, { passive: true });
window.addEventListener("resize", closeAllFloatingPanels);
// Escape closes whichever floating panel is open and returns focus to its
// trigger button — standard keyboard behavior for popovers/menus.
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (historyPanel.classList.contains("open")) { closeHistoryPanel(); historyToggleBtn.focus(); }
  else if (templatesPanel.classList.contains("open")) { closeTemplatesPanel(); templatesToggleBtn.focus(); }
  else if (importPanel.classList.contains("open")) { closeImportPanel(); importToggleBtn.focus(); }
  else if (logoSettingsPanel.classList.contains("open")) { closeLogoSettingsPanel(); logoSettingsBtn.focus(); }
});

export function closeHistoryPanel() {
  historyPanel.classList.remove("open");
  historyToggleBtn.setAttribute("aria-expanded", "false");
  if (phoneQuery.matches && !mobileDrawer.classList.contains("open") && !templatesPanel.classList.contains("open") && !importPanel.classList.contains("open")) drawerOverlay.classList.remove("show");
}
historyToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeTemplatesPanel();
  closeImportPanel();
  closeLogoSettingsPanel();
  const open = historyPanel.classList.toggle("open");
  historyToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionDropdownPanel(historyPanel, historyToggleBtn);
  // On phone widths the panel opens as its own centered card (the drawer is
  // too narrow to anchor a dropdown under the button), so hide the sections
  // drawer but keep a dimmed backdrop behind the card.
  if (phoneQuery.matches) {
    mobileDrawer.classList.remove("open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
    drawerOverlay.classList.toggle("show", open);
  }
});
document.addEventListener("click", e => { const path = e.composedPath(); if (!path.includes(historyPanel) && !path.includes(historyToggleBtn)) closeHistoryPanel(); });
drawerOverlay.addEventListener("click", closeHistoryPanel);

// Brand "Templates" dropdown — same pattern as History above, for saving/
// reusing company info + design across different companies/personal brands.
const templatesToggleBtn = $("templatesToggleBtn"), templatesPanel = $("templatesPanel");
export function closeTemplatesPanel() {
  templatesPanel.classList.remove("open");
  templatesToggleBtn.setAttribute("aria-expanded", "false");
  if (phoneQuery.matches && !mobileDrawer.classList.contains("open") && !historyPanel.classList.contains("open") && !importPanel.classList.contains("open")) drawerOverlay.classList.remove("show");
}
templatesToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeHistoryPanel();
  closeImportPanel();
  closeLogoSettingsPanel();
  const open = templatesPanel.classList.toggle("open");
  templatesToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionDropdownPanel(templatesPanel, templatesToggleBtn);
  if (phoneQuery.matches) {
    mobileDrawer.classList.remove("open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
    drawerOverlay.classList.toggle("show", open);
  }
});
document.addEventListener("click", e => { const path = e.composedPath(); if (!path.includes(templatesPanel) && !path.includes(templatesToggleBtn)) closeTemplatesPanel(); });
drawerOverlay.addEventListener("click", closeTemplatesPanel);

// "Import Items" dropdown (CSV/Excel import + its how-to tutorial + the
// destructive "Clear all line items" action) — same floating-panel pattern
// as History/Templates above, now living in the main Edit Canvas toolbar
// instead of buried in the Items tab, where an import/clear action is
// easy to miss and doesn't read as belonging to the canvas toolbar at all.
const importToggleBtn = $("importToggleBtn"), importPanel = $("importPanel");
export function closeImportPanel() {
  importPanel.classList.remove("open");
  importToggleBtn.setAttribute("aria-expanded", "false");
  if (phoneQuery.matches && !mobileDrawer.classList.contains("open") && !historyPanel.classList.contains("open") && !templatesPanel.classList.contains("open")) drawerOverlay.classList.remove("show");
}
importToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeHistoryPanel();
  closeTemplatesPanel();
  closeLogoSettingsPanel();
  const open = importPanel.classList.toggle("open");
  importToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionDropdownPanel(importPanel, importToggleBtn);
  if (phoneQuery.matches) {
    mobileDrawer.classList.remove("open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
    drawerOverlay.classList.toggle("show", open);
  }
});
document.addEventListener("click", e => { const path = e.composedPath(); if (!path.includes(importPanel) && !path.includes(importToggleBtn)) closeImportPanel(); });
drawerOverlay.addEventListener("click", closeImportPanel);
// Both actions inside are one-shot (open a file picker, or clear-with-
// confirm) rather than a list of items to keep working through, so — same
// convention as the phone "more actions" popover — close the panel right
// after either is clicked instead of leaving it open.
importPanel.querySelectorAll("button").forEach(b => b.addEventListener("click", closeImportPanel));
// Re-run positioning when the CSV/Excel tutorial accordion opens or closes:
// it changes the panel's content height well after positionDropdownPanel()
// first ran (on open), so without this the panel's remembered position/
// max-height goes stale the moment the tutorial expands — see the long
// comment on positionDropdownPanel() above for the full story.
const importHelpDetails = importPanel.querySelector(".importhelp");
if (importHelpDetails) {
  importHelpDetails.addEventListener("toggle", () => {
    if (importPanel.classList.contains("open")) positionDropdownPanel(importPanel, importToggleBtn);
  });
}

// Logo settings popover, anchored to the "Logo settings" trigger next to
// the logo on the invoice canvas itself (not the toolbar row above it) —
// same floating-panel pattern again, so selecting/resizing/positioning the
// logo follows the same "click to open a small property panel" convention
// as every other tool in the app instead of a permanent row of controls
// crowding the invoice header at all times.
const logoSettingsBtn = $("logoSettingsBtn"), logoSettingsPanel = $("logoSettingsPanel");
export function closeLogoSettingsPanel() {
  logoSettingsPanel.classList.remove("open");
  logoSettingsBtn.setAttribute("aria-expanded", "false");
}
logoSettingsBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeHistoryPanel();
  closeTemplatesPanel();
  closeImportPanel();
  const open = logoSettingsPanel.classList.toggle("open");
  logoSettingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionDropdownPanel(logoSettingsPanel, logoSettingsBtn, 280);
});
document.addEventListener("click", e => { const path = e.composedPath(); if (!path.includes(logoSettingsPanel) && !path.includes(logoSettingsBtn)) closeLogoSettingsPanel(); });

// Collapsible sections — tap a panel heading to expand/collapse it. Color
// and Show/hide sections both start expanded (see index.html) since their
// controls are commonly needed right away; collapsing is still available
// per-panel for anyone who wants to tuck a section away.
document.querySelectorAll(".panelhead").forEach(h => {
  h.addEventListener("click", () => {
    const panel = h.closest(".panel");
    if (panel) panel.classList.toggle("collapsed");
  });
});
