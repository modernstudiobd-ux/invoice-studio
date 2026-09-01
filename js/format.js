// format.js — number/date/currency formatting.
//
// Currency renders with a real symbol (₹, €, ₩, ...) rather than the ISO
// code — see CURRENCY_SYMBOLS below, which is a curated, hand-picked symbol
// per currency rather than pulling Intl's own currencyDisplay:"symbol".
// That choice is deliberate: for several locales (bn-BD, ne-NP, si-LK, the
// Arabic ones, ...) Intl's native formatting doesn't just swap in a symbol,
// it *also* switches the digits themselves to that locale's native numeral
// system (Bengali/Devanagari/Arabic-Indic digits) — e.g. Taka would come
// out as "১,২৩৪.৫০৳" with no Western digits at all. That's the right
// behavior for a document meant to be read only by a local reader, but
// wrong for an invoice meant to be read internationally, so amounts always
// use plain Western digits/grouping here regardless of currency, with only
// the symbol changing.
//
// A handful of the symbols below (₹ ₩ ₪ ₦ ₴ ₺ ₽ ₱ ₫ ₵ ł č ฿ ৳) aren't in the
// self-hosted Inter font — see the small offline-cached fallback subsets
// wired up under the "Inter" family in css/base.css (unicode-range) for why
// these still render correctly with no network connection.

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

// Kept only for anything that still wants a locale hint (not used by
// money()/moneyFor() anymore, which always format digits the same way).
export const CURRENCY_LOCALE = { USD: "en-US", CAD: "en-CA", MXN: "es-MX", BRL: "pt-BR", ARS: "es-AR", CLP: "es-CL", COP: "es-CO", PEN: "es-PE", UYU: "es-UY", JMD: "en-JM", EUR: "de-DE", GBP: "en-GB", CHF: "de-CH", SEK: "sv-SE", NOK: "nb-NO", DKK: "da-DK", PLN: "pl-PL", CZK: "cs-CZ", HUF: "hu-HU", RON: "ro-RO", UAH: "uk-UA", RUB: "ru-RU", TRY: "tr-TR", AED: "ar-AE", SAR: "ar-SA", QAR: "ar-QA", KWD: "ar-KW", BHD: "ar-BH", OMR: "ar-OM", ILS: "he-IL", EGP: "ar-EG", ZAR: "en-ZA", NGN: "en-NG", KES: "en-KE", GHS: "en-GH", AUD: "en-AU", NZD: "en-NZ", JPY: "ja-JP", CNY: "zh-CN", HKD: "zh-HK", TWD: "zh-TW", KRW: "ko-KR", SGD: "en-SG", INR: "en-IN", PKR: "en-PK", BDT: "bn-BD", LKR: "si-LK", NPR: "ne-NP", IDR: "id-ID", MYR: "ms-MY", PHP: "en-PH", THB: "th-TH", VND: "vi-VN" };

// One symbol per currency. Single-character symbols sit tight against the
// number ("$1,234.50", "₹1,234.50"); multi-letter abbreviations get a space
// ("CHF 1,234.50", "Rs 1,234.50") — used where no single universal symbol
// exists (Gulf currencies, PKR/LKR/NPR all sharing "Rs", etc).
export const CURRENCY_SYMBOLS = { USD: "$", CAD: "$", MXN: "$", BRL: "R$", ARS: "$", CLP: "$", COP: "$", PEN: "S/", UYU: "$", JMD: "J$", EUR: "€", GBP: "£", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč", HUF: "Ft", RON: "lei", UAH: "₴", RUB: "₽", TRY: "₺", AED: "AED", SAR: "SAR", QAR: "QAR", KWD: "KWD", BHD: "BHD", OMR: "OMR", ILS: "₪", EGP: "EGP", ZAR: "R", NGN: "₦", KES: "KSh", GHS: "₵", AUD: "$", NZD: "$", JPY: "¥", CNY: "¥", HKD: "HK$", TWD: "NT$", KRW: "₩", SGD: "S$", INR: "₹", PKR: "Rs", BDT: "৳", LKR: "Rs", NPR: "Rs", IDR: "Rp", MYR: "RM", PHP: "₱", THB: "฿", VND: "₫" };

function formatAmount(v, code) {
  const symbol = CURRENCY_SYMBOLS[code] || code;
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v));
  return symbol + ([...symbol].length === 1 ? "" : " ") + n;
}

export function money(v) {
  return formatAmount(v, $("currency").value);
}

export function moneyFor(v, c) {
  return formatAmount(v, c || "USD");
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
