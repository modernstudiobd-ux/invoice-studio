// logo.js — shared logo file handling for the Details tab's logo upload,
// remove, and reset-size controls.

import { $ } from "./dom.js";
import { state } from "./state.js";
import { renderPreview } from "./preview.js";
import { save } from "./persistence.js";
import { toast } from "./toast.js";

export function naturalLogoHeight() {
  const n = state.logoNatural;
  if (!n || !n.h) return 48;
  return Math.round(Math.max(24, Math.min(160, n.h)));
}

// `inputEl` is optional — when the file came from an <input type=file>, its
// value is cleared on rejection so the same (invalid) file can be reselected
// after the person notices the toast; drag-and-drop / paste sources have no
// such input to clear.
export function handleLogoFile(file, inputEl) {
  if (!file) return;
  if (file.size > 3e6) { toast("Logo must be under 3 MB."); if (inputEl) inputEl.value = ""; return; }
  if (!/^image\//.test(file.type)) { toast("Please select a valid image file."); if (inputEl) inputEl.value = ""; return; }
  const r = new FileReader();
  r.onerror = () => toast("The logo could not be read.");
  r.onload = () => {
    const test = new Image();
    test.onerror = () => toast("The selected logo image is not valid.");
    test.onload = () => {
      state.logo = String(r.result);
      state.logoNatural = { w: test.naturalWidth || 120, h: test.naturalHeight || 48 };
      $("logoHeight").value = naturalLogoHeight();
      $("logoHint").textContent = file.name + " added";
      renderPreview(); save(); toast("Logo added.");
    };
    test.src = String(r.result);
  };
  r.readAsDataURL(file);
}

export function removeLogo() {
  state.logo = ""; state.logoNatural = null;
  $("logoFile").value = "";
  $("logoHint").textContent = "PNG, JPG, WEBP or SVG. Maximum 3 MB.";
  renderPreview(); save(); toast("Logo removed.");
}
