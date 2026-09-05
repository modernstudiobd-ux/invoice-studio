// layout.js — all the "app chrome" wiring: resizable/collapsible sidebar,
// desktop tabs, mobile edit/preview switcher + drawer + fullscreen preview,
// and the phone bottom-bar "more actions" popover. No invoice business logic.

import { $ } from "./dom.js";
import { fitInvoiceCanvas } from "./preview.js";

const sidebarResizer = $("sidebarResizer"), appRoot = $("appRoot");
let resizingSidebar = false;
const savedSidebarWidth = Number(localStorage.getItem("invoiceStudio.sidebarWidth"));
if (savedSidebarWidth >= 320 && savedSidebarWidth <= 720) {
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
  const width = Math.max(320, Math.min(720, e.clientX));
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
  document.documentElement.style.setProperty("--sidebar-width", "430px");
  localStorage.setItem("invoiceStudio.sidebarWidth", "430");
});

const sidebarToggleBtn = $("sidebarToggleBtn");
export function setSidebarCollapsed(collapsed) {
  appRoot.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggleBtn.textContent = collapsed ? "›" : "‹";
  sidebarToggleBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  sidebarToggleBtn.setAttribute("aria-label", sidebarToggleBtn.title);
  localStorage.setItem("invoiceStudio.sidebarCollapsed", collapsed ? "1" : "0");
}
sidebarToggleBtn.addEventListener("click", () => setSidebarCollapsed(!appRoot.classList.contains("sidebar-collapsed")));
setSidebarCollapsed(localStorage.getItem("invoiceStudio.sidebarCollapsed") === "1");

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

const tabButtons = Array.from(document.querySelectorAll(".tab"));
export function activateTab(b, focus) {
  tabButtons.forEach(x => { let on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1; });
  document.querySelectorAll(".tabpane").forEach(x => x.classList.toggle("active", x.id === "tab-" + b.dataset.tab));
  if (focus) b.focus();
}
tabButtons.forEach((b, i) => {
  b.onclick = () => activateTab(b, false);
  b.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let next = i;
    if (e.key === "ArrowLeft") next = (i - 1 + tabButtons.length) % tabButtons.length;
    else if (e.key === "ArrowRight") next = (i + 1) % tabButtons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabButtons.length - 1;
    activateTab(tabButtons[next], true);
  });
});

// In-text links that jump to another tab (e.g. "table columns" inside the
// CSV/Excel import help panel, pointing back to the Table Columns tab).
document.addEventListener("click", e => {
  const link = e.target.closest("[data-goto-tab]");
  if (!link) return;
  e.preventDefault();
  const tabBtn = $("tabbtn-" + link.dataset.gotoTab);
  if (tabBtn) activateTab(tabBtn, true);
});

/* --- Mobile chrome (additive UI-only wiring; no business logic here) --- */

// Hamburger drawer: switches Details/Items/Design via the existing activateTab().
const hamburgerBtn = $("hamburgerBtn"), mobileDrawer = $("mobileDrawer"), drawerOverlay = $("drawerOverlay"), drawerCloseBtn = $("drawerCloseBtn");
const drawerItems = Array.from(document.querySelectorAll(".drawer-item"));
function openDrawer() { mobileDrawer.classList.add("open"); drawerOverlay.classList.add("show"); mobileDrawer.setAttribute("aria-hidden", "false"); hamburgerBtn.setAttribute("aria-expanded", "true"); }
function closeDrawer() { mobileDrawer.classList.remove("open"); drawerOverlay.classList.remove("show"); mobileDrawer.setAttribute("aria-hidden", "true"); hamburgerBtn.setAttribute("aria-expanded", "false"); }
hamburgerBtn.addEventListener("click", openDrawer);
drawerCloseBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
drawerItems.forEach(btn => btn.addEventListener("click", () => {
  const tabBtn = $("tabbtn-" + btn.dataset.tab);
  if (tabBtn) activateTab(tabBtn, false);
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

// Draft / Preview canvas switch — "Draft" (default) shows every optional
// field/row even when left blank (see the placeholder text preview.js
// renders for them, e.g. "—" / "Add value"), so it's clear what's
// available to fill in on the Details tab; "Preview" hides those empty
// optional rows via the .canvas-preview-mode rule in invoice.css — the
// same .print-hide-empty class @media print already uses — so it's a
// faithful, live dry run of the actual Print/PDF output, not a separate
// approximation of it. That includes being genuinely non-editable, the
// same way a real print preview is: setCanvasEditable() below locks every
// real field living directly on the document (see setInvoiceFieldsEditable)
// the instant Preview turns on, and unlocks them the instant Draft
// returns — editing still happens freely through the sidebar's Items/
// Table Columns/Design tabs and the page-setup toolbar, none of which are
// part of the document itself.
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
  setInvoiceFieldsEditable(!isPreview);
  // Draft and Preview size the canvas wrapper differently (auto-height form
  // vs. fixed page multiples — see fitInvoiceCanvas in preview.js), so the
  // wrapper needs re-measuring the instant the mode actually changes, not
  // just on the next unrelated re-render/resize.
  fitInvoiceCanvas();
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
// overflow-x:auto — see the comment on .history-panel in base.css). On
// phone widths the panel is centered via its own CSS media query instead,
// so any inline position from a previous desktop placement is cleared.
function positionDropdownPanel(panel, toggleBtn) {
  if (phoneQuery.matches) {
    panel.style.top = "";
    panel.style.left = "";
    panel.style.width = "";
    return;
  }
  const r = toggleBtn.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 32);
  let left = r.left + r.width / 2 - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  panel.style.width = width + "px";
  panel.style.left = left + "px";
  panel.style.top = (r.bottom + 8) + "px";
}
// Horizontally scrolling the toolbar row would leave an already-open panel
// visually anchored to where its button used to be, so just close it —
// simpler and safer than recomputing position continuously on scroll.
const toolbarRowEl = document.querySelector(".toolbar-row");
if (toolbarRowEl) toolbarRowEl.addEventListener("scroll", () => { closeHistoryPanel(); closeTemplatesPanel(); }, { passive: true });

export function closeHistoryPanel() {
  historyPanel.classList.remove("open");
  historyToggleBtn.setAttribute("aria-expanded", "false");
  if (phoneQuery.matches && !mobileDrawer.classList.contains("open") && !templatesPanel.classList.contains("open")) drawerOverlay.classList.remove("show");
}
historyToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeTemplatesPanel();
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
  if (phoneQuery.matches && !mobileDrawer.classList.contains("open") && !historyPanel.classList.contains("open")) drawerOverlay.classList.remove("show");
}
templatesToggleBtn.addEventListener("click", e => {
  e.stopPropagation();
  closeHistoryPanel();
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

// Collapsible sections — tap a panel heading to expand/collapse it (every
// width now; less-used panels start collapsed by default — see main.js —
// so the sidebar itself takes up less room without losing any control).
document.querySelectorAll(".panelhead").forEach(h => {
  h.addEventListener("click", () => {
    const panel = h.closest(".panel");
    if (panel) panel.classList.toggle("collapsed");
  });
});
