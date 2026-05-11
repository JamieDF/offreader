# foliate-js local copies

This directory contains three files derived from the
[foliate-js](https://github.com/johnfactotum/foliate-js) library (MIT licence).
They live here rather than being consumed directly from the npm package because
each one required modifications that cannot yet be upstreamed, or because the
file does not exist in the published npm release at all.

The long-term intent is to publish a maintained fork as `@jamiedf/foliate-js`
on npm and remove these copies entirely. Until that happens, any upstream
changes to the originating files must be merged manually.

---

## foliate-view.js

**Origin:** `view.js` in the foliate-js GitHub repository.  
**npm status:** Not exported from the npm package — taken directly from GitHub.  
**Upstream ref:** https://github.com/johnfactotum/foliate-js/blob/main/view.js

### Deviations from upstream

| # | Change | Reason |
|---|--------|--------|
| 1 | All internal import paths rewritten from relative (`./epub.js`) to package-qualified (`foliate-js/epub.js`) | Vite must resolve sibling modules via `node_modules`, not relative to `src/lib/` |
| 2 | Added `isPDF()` byte-sniffing helper | Required to detect PDF files before routing |
| 3 | Added `else if (await isPDF(file))` branch in `makeBook()` that delegates to `./foliate-pdf.js` | Upstream has no PDF support; this is the entire PDF pipeline entry point |

### Notes
A few minor things present in the upstream version were not carried over:
- `exportparts` attribute value includes `container` upstream but not here
- `initTTS` signature differs slightly (upstream accepts a `highlight` callback)

These are low-risk for current app functionality but should be reconciled when
merging upstream changes.

---

## foliate-pdf.js

**Origin:** `pdf.js` in the foliate-js GitHub repository.  
**npm status:** Does not exist in the npm package — taken directly from GitHub.  
**Upstream ref:** https://github.com/johnfactotum/foliate-js/blob/main/pdf.js

### Deviations from upstream

| # | Change | Reason |
|---|--------|--------|
| 1 | Added `rotation` parameter to `render()` | pdfjs `getViewport()` accepts rotation in degrees; needed to re-render pages at a different orientation |
| 2 | Added `rotation` parameter to `renderPage()`, threaded through to `render()` via the `onZoom` closure | `onZoom` is called by the renderer on every zoom change; it must carry the current rotation so re-renders are correct |
| 3 | Added `let currentRotation = 0` in `makePDF()` closure | Mutable rotation state shared across all section `load()` calls without breaking the existing cache pattern |
| 4 | Added `book.setRotation(rotation)` method | Called by the app when the user rotates the page; updates `currentRotation` and clears the section URL cache so the next `load()` re-renders with the new rotation |
| 5 | Extended `book.metadata` extraction | Upstream only extracts title and author; added description, language, publisher, identifier, and rights fields |

---

## foliate-fxl.js

**Origin:** `fixed-layout.js` in the foliate-js npm package (`foliate-js/fixed-layout.js`).  
**npm status:** Published in the npm package — taken from there.  
**Upstream ref:** https://github.com/johnfactotum/foliate-js/blob/main/fixed-layout.js

### Deviations from upstream

| # | Change | Reason |
|---|--------|--------|
| 1 | Added `async reload()` method | `goToSpread()` has an early-return guard (`if (index === this.#index) return`) that prevents reloading the current page. After a rotation change the section cache is cleared and the page must be re-fetched, but `goTo()` silently does nothing. `reload()` resets `#index` to `-1` to bypass the guard, then calls `goToSpread()` normally. This is a candidate for an upstream PR. |
| 2 | Changed `:host` CSS from `justify-content: center` / `align-items: center` to `justify-content: safe center` / `align-items: safe center` | `center` with `overflow: auto` makes the left/top overflow inaccessible (scrollLeft can't go negative), so ~20% of a zoomed-in page is permanently unreachable. `safe center` falls back to `flex-start` when content overflows, making the full page pannable while preserving centering at fit-page/fit-width zoom. |

---

## Keeping in sync with upstream

**Note:** The foliate-js GitHub repository is noticeably more active and up to date
than the npm releases. Future syncs should consider pulling directly from the GitHub
`main` branch rather than waiting for an npm release — particularly for `pdf.js`
which has never been published to npm at all. This is another argument for
maintaining a proper fork rather than depending on the npm package.

These local copies were last synchronised against **foliate-js v1.0.1** (npm).
The `pdf.js` upstream ref is from the GitHub `main` branch at the time of that
npm release — it has no independent version number.

When upgrading foliate-js, pin the version in `package.json` explicitly and
diff the new package files against the local copies before installing:

```bash
diff node_modules/foliate-js/fixed-layout.js src/lib/foliate-fxl.js
diff node_modules/foliate-js/view.js src/lib/foliate-view.js
# For pdf.js, diff against the GitHub file at the corresponding commit tag
```

Update this version number here whenever the npm dependency is bumped.
