// toast.js — small transient status messages shown bottom-right (or
// bottom-center on phone, see responsive.css).

import { $ } from "./dom.js";

export function toast(s) {
  let e = $("toast");
  e.textContent = s;
  e.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => e.classList.remove("show"), 2200);
}
