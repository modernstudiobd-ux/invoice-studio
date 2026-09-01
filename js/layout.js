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

// Edit / Preview canvas switch — "Edit" (default) is today's click-anything
// live-editable canvas; "Preview" strips every editing affordance (hover
// outlines, placeholder hint text, delete/resize/logo controls, empty
// optional rows) via the .canvas-preview-mode rules in inline-edit.css, the
// same rules @media print already uses — so it's a faithful, live dry run
// of the actual Print/PDF output, not a separate approximation of it.
const canvasModeEditBtn = $("canvasModeEditBtn"), canvasModePreviewBtn = $("canvasModePreviewBtn");
export function setCanvasMode(mode) {
  const isPreview = mode === "preview";
  document.body.classList.toggle("canvas-preview-mode", isPreview);
  canvasModeEditBtn.classList.toggle("active", !isPreview);
  canvasModeEditBtn.setAttribute("aria-selected", String(!isPreview));
  canvasModePreviewBtn.classList.toggle("active", isPreview);
  canvasModePreviewBtn.setAttribute("aria-selected", String(isPreview));
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
