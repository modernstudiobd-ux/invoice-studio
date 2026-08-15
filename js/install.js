// install.js — the Android/Chrome "Install this app" banner and service
// worker registration. (iOS Safari has no beforeinstallprompt API and keeps
// using the manual Share-sheet flow, per the README.)

import { $ } from "./dom.js";
import { toast } from "./toast.js";

export function initInstallPrompt() {
  let deferredInstallPrompt = null;
  const installBanner = $("installBanner"), installAppBtn = $("installAppBtn"), installDismissBtn = $("installDismissBtn");
  const INSTALL_DISMISS_KEY = "invoiceStudio.installDismissed";
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBanner && localStorage.getItem(INSTALL_DISMISS_KEY) !== "1") installBanner.classList.remove("hidden");
  });
  if (installAppBtn) installAppBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (installBanner) installBanner.classList.add("hidden");
    if (choice.outcome === "accepted") toast("Installed — look for it on your home screen.");
  });
  if (installDismissBtn) installDismissBtn.addEventListener("click", () => {
    if (installBanner) installBanner.classList.add("hidden");
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch {}
  });
  window.addEventListener("appinstalled", () => {
    if (installBanner) installBanner.classList.add("hidden");
    deferredInstallPrompt = null;
  });
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker registration failed:", err));
    });
  }
}
