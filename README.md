# Invoice Studio Pro — PWA build

This folder is your original app turned into an installable Progressive Web App:
it can be added to a phone's home screen, opens without browser chrome, and
keeps working with no internet connection (everything except the optional
Excel-file import, which needs the network the first time it's used).

## Project structure
The app was originally a single 1,200-line `index.html` file. It's now split
into focused, single-purpose files so it's easier to find and safely change
things as the app grows — no build step required, it's plain HTML/CSS/JS that
any static host can serve as-is.

```
index.html               Page structure/markup only
manifest.webmanifest     PWA metadata (name, icons, colors)
sw.js                    Offline caching (service worker)
css/
  base.css                Layout shell, buttons, form fields, panels, tabs, toast
  invoice.css              The invoice document itself (header, table, totals)
  templates.css            Classic/Compact template variant overrides
  responsive.css           Mobile + tablet breakpoints, sidebar collapse
  print.css                Print/PDF-preview output rules
js/
  dom.js, state.js, format.js, calc.js, toast.js, accent.js
                           Small shared helpers and the single app state object
  preview.js               Renders the live invoice preview
  columns.js, items.js, toggles.js
                           The three editors in the sidebar (columns/items/sections)
  persistence.js           Autosave + undo/redo
  invoiceData.js           Loads a saved/imported invoice back into the app
  library.js                The "Saved invoices" History panel
  layout.js                  Sidebar resize/collapse, tabs, mobile drawer
  importSheet.js             CSV/XLSX spreadsheet import
  pdfExport.js                PDF export + print
  install.js                   "Install this app" banner + service worker registration
  main.js                       Entry point — wires everything together and boots the app
```

`js/main.js` is loaded as an ES module (`<script type="module">`), so the
browser resolves all the `import`/`export` statements between these files
natively — there's still no build/bundle step to run. If you ever do want a
bundler (e.g. for minification or TypeScript), this file layout maps directly
onto it with no further restructuring needed.

## Important: this must be served over HTTP(S), not opened as a file
Service workers (the thing that makes offline + install work) refuse to run
on `file://` URLs. `localhost` is the one exception, which is why local
testing below works even without HTTPS. ES modules have the same restriction,
so this applies doubly now — always test via a local server, never by
double-clicking `index.html`.

## Try it locally right now
From inside this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in Chrome (desktop or Android) — you'll see
an install icon in the address bar / a "Install app" option in the menu.

## Put it on your phone
Pick any static host — all of these give you free HTTPS, which is required
once you're not on localhost:

- **Netlify Drop** — go to app.netlify.com/drop and drag this whole folder in.
  You get a live HTTPS URL in seconds, no account needed for a quick test.
- **GitHub Pages** — push this folder to a repo, enable Pages on it, done.
- **Vercel** — `vercel deploy` from inside this folder (needs their CLI/account).

Once it's live on an HTTPS URL:

**Android (Chrome):** open the URL → tap the three-dot menu → "Add to Home
screen" / "Install app". It'll behave like a native app icon, launching full
screen with no address bar.

**iPhone/iPad (Safari):** open the URL → tap the Share icon → "Add to Home
Screen". iOS uses its own home-screen mechanism (the `apple-touch-icon` and
`apple-mobile-web-app-*` meta tags already added handle this), it won't show
Chrome's install prompt.

## Updating the app later
If you edit any file in `css/` or `js/`, bump the `VERSION` constant at the
top of `sw.js` (e.g. `v2.0.0` → `v2.0.1`). That changes the cache name, so the
service worker knows to fetch and cache the new files instead of serving the
old cached copy. Without this bump, returning users may keep seeing the old
version until they manually clear site data. If you add or rename a file in
`css/` or `js/`, also update the `SHELL_ASSETS` list near the top of `sw.js`
so the new file gets cached too.

## Notes
- Data still saves to the browser's `localStorage`, exactly as before — each
  device/browser you install this on keeps its own saved invoice.
- The Excel (`.xlsx`) import still loads a small library from a CDN on first
  use; CSV import and everything else works fully offline immediately.
- Currency amounts always show the 3-letter code (e.g. `USD`, `INR`) rather
  than a symbol, so nothing breaks if a font is missing a currency glyph.
