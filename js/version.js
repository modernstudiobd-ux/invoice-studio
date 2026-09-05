// version.js — single source of truth for the app build/version string.
// This file is bumped by the maintainer on every delivered update so the
// user can always confirm (in the header badge or the browser console)
// which build they're running.
//
// Format: vMAJOR.MINOR.PATCH (semantic-ish) + build date (YYYY-MM-DD).
// Increment PATCH for fixes/tweaks, MINOR for new features,
// MAJOR only for breaking/rewrite-level changes.

// Kept in lockstep with the VERSION constant in sw.js (which drives cache
// busting) — bump both together on every delivered update.
export const APP_VERSION = "3.15.3";
export const BUILD_DATE = "2026-09-05";
export const BUILD_STRING = `v${APP_VERSION} (${BUILD_DATE})`;
