// format.js — number/date/currency formatting. Currency always renders with
// the ISO code (e.g. "INR", "JPY") rather than a currency symbol, since some
// symbols (₹, ₩, ₦, ֏, ...) are missing from certain fonts/PDF exports.

import { $, esc } from "./dom.js";

export function num(v) {
  v = Number(v);
  return Number.isFinite(v) ? v : 0;
}

export function today() {
  let d = new Date(), o = d.getTimezoneOffset();
  return new Date(d - o * 60000).toISOString().slice(0, 10);
}

export function plusDays(s, n) {
  let d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function alignClass(a) {
  return a === "right" ? "right" : a === "center" ? "center" : "";
}

export function dateFmt(v) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v + "T00:00:00"));
}

export const CURRENCY_LOCALE = { USD: "en-US", CAD: "en-CA", MXN: "es-MX", BRL: "pt-BR", ARS: "es-AR", CLP: "es-CL", COP: "es-CO", PEN: "es-PE", UYU: "es-UY", JMD: "en-JM", EUR: "de-DE", GBP: "en-GB", CHF: "de-CH", SEK: "sv-SE", NOK: "nb-NO", DKK: "da-DK", PLN: "pl-PL", CZK: "cs-CZ", HUF: "hu-HU", RON: "ro-RO", UAH: "uk-UA", RUB: "ru-RU", TRY: "tr-TR", AED: "ar-AE", SAR: "ar-SA", QAR: "ar-QA", KWD: "ar-KW", BHD: "ar-BH", OMR: "ar-OM", ILS: "he-IL", EGP: "ar-EG", ZAR: "en-ZA", NGN: "en-NG", KES: "en-KE", GHS: "en-GH", AUD: "en-AU", NZD: "en-NZ", JPY: "ja-JP", CNY: "zh-CN", HKD: "zh-HK", TWD: "zh-TW", KRW: "ko-KR", SGD: "en-SG", INR: "en-IN", PKR: "en-PK", BDT: "bn-BD", LKR: "si-LK", NPR: "ne-NP", IDR: "id-ID", MYR: "ms-MY", PHP: "en-PH", THB: "th-TH", VND: "vi-VN" };

export function money(v) {
  let c = $("currency").value, loc = CURRENCY_LOCALE[c] || "en-US";
  try { return new Intl.NumberFormat(loc, { style: "currency", currency: c, currencyDisplay: "code", minimumFractionDigits: 2 }).format(num(v)); }
  catch { return c + " " + num(v).toFixed(2); }
}

export function moneyFor(v, c) {
  const cur = c || "USD", loc = CURRENCY_LOCALE[cur] || "en-US";
  try { return new Intl.NumberFormat(loc, { style: "currency", currency: cur, currencyDisplay: "code", minimumFractionDigits: 2 }).format(num(v)); }
  catch { return cur + " " + num(v).toFixed(2); }
}

export function normalizeKey(s) {
  return String(s || "column").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "column";
}

export function fmtCell(v, col) {
  if (col.type === "currency") return money(v);
  if (col.type === "number") return num(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (col.type === "percentage") return num(v).toFixed(2).replace(/\.00$/, "") + "%";
  if (col.type === "date") return dateFmt(v);
  return esc(v).replaceAll("\n", "<br>");
}
