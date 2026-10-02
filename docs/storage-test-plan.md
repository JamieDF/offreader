# Storage Rework: Manual Test Plan

Branch: `storage-rework`. Test in order: cheapest surface first, so a core
regression is caught before touching Android.

## Fixtures to prep

- A handful of epubs/pdfs, including: one big file (30MB+), a file with
  Windows-hostile chars in the title (`:` `?` `*`), and a duplicate file
  (same bytes, different filename).
- A test folder with ~10+ books, including a nested subfolder, for sync tests.
- A second copy of that folder elsewhere (for "move/rename" tests).

---

## Phase 1: Web (managed storage core)

`npm run dev`

Most of this phase is covered by `tests/e2e/storage.spec.ts` (chromium +
mobile, both passing): hash-keyed blob in `offreader-files`, duplicate
rejection (same file *and* renamed same bytes), blob deletion on remove,
and reload persistence. Remaining manual checks:

- [ ] **Open it**: book renders, no console errors. (covered implicitly by
  existing reader specs)
- [ ] **Duplicate toast actually displays**: e2e asserts the toast text is
  in the DOM; a visual glance confirms it renders styled. (Was broken , 
  `toast.info` didn't exist; fixed.)
- [ ] **Delete**: remove a book → its blob disappears from `offreader-files`.
- [ ] **Legacy migration** (only if the dev profile has pre-rework books) , 
  first load migrates `books/<uuid>.<ext>` entries to hash keys; books still
  open; no dupes.
- [ ] **Restart**: close/reopen the tab, library intact (persist request may
  prompt a browser-level grant on some setups: fine either way).

## Phase 2: Electron (linked mode + folder sync + open-with + export)

`npm run electron:dev`

### Linked import

- [ ] **Import → mode dialog**: import a file; "Link in place / Copy into
  library" choice appears; default follows the Manage Library setting
  (Electron default: linked).
- [ ] **Linked book opens**: streams via `offreader-file://`; big file
  (30MB+) opens without hanging.
- [ ] **Managed copy still works**: import with "Copy" → lands in IndexedDB.
- [ ] **Delete linked book**: source file still on disk untouched.
- [ ] **Mixed duplicate**: import file X linked, then copy-file X managed →
  both books coexist sharing the hash; deleting the managed one must not
  break the linked one (and vice versa).

### Missing + relink

- [ ] **Rename/move a linked source file** → rescan or restart → book shows
  "Missing" badge (library card).
- [ ] **Open missing book**: reader error state shows the expected path +
  "Relink file…" button.
- [ ] **Relink** → native picker → pick the moved file → book works again,
  badge clears, progress intact.
- [ ] **Relink with wrong file**: pick a different book → becomes that book
  (hash changes); sanity check this is acceptable behavior.

### Folder sync

- [ ] **Add sync folder** (Manage Library → Sync folders → native picker) →
  initial scan imports all supported files recursively, incl. nested dirs,
  all as linked.
- [ ] **Add a file** to the folder while app runs → appears in library within
  a few seconds (chokidar + debounce).
- [ ] **Rename/move a file inside the folder** → book repoints (same book,
  progress kept) rather than duplicating.
- [ ] **Delete a file** → its book goes Missing; **move it back** → badge
  clears on next scan.
- [ ] **Unsupported files** in the folder are ignored.
- [ ] **Restart** → watchers resume, startup rescan runs, nothing
  re-imports/duplicates.
- [ ] **Remove folder** in Manage Library → watcher stops; books remain
  (they're linked, files still exist).
- [ ] **Rescan button**: spinner shows, completes.

### Open-with

- [ ] `cd electron && npx electron . /path/to/book.epub`: cold launch with a
  file arg → app opens and imports it (respects import mode setting).
- [ ] With the app already running, launch again with a file → second instance
  forwards the file to the running window.
- [ ] Packaged build (`electron:build`) → right-click → Open With on a real
  epub registers the association.

### Export

- [ ] **Export library** (Manage Library → Backup) → pick destination →
  `Title - Author.ext` files + `offreader-library.json` manifest appear.
- [ ] Managed books export real bytes (open one from the export dir).
- [ ] Linked books are copied out too (native copy).
- [ ] Hostile-title file exports with a sanitized name; two books with the
  same title don't collide.
- [ ] Re-export to the same dir doesn't explode.

## Phase 3: Android (SAF)

`npm run cap:build` then `npm run cap:android` (or Android Studio)

- [ ] **Add sync folder** → SAF tree picker → grant permission → folder
  scans, linked books appear.
- [ ] **Restart the app** → folder still listed (URI permission persisted),
  rescan runs on open.
- [ ] **Open an SAF-linked book**: reads via content resolver → cache copy;
  renders.
- [ ] **Delete source file** (in a file manager) → rescan → Missing badge;
  relink via `pickDocument` works.
- [ ] **Managed import**: normal import still lands in private
  `Directory.Data` (not visible in file managers: the original bug).
- [ ] **Large file**: 30MB+ through the SAF cache path.
- [ ] **Export on Android**: SAF directory picker, files land in the chosen
  folder.

## Known-expected quirks (don't report as bugs)

- Watch depth capped at 10 nested levels.
- Relink doesn't verify it's the "same" book: hash just repoints.
- `navigator.storage.persist()` may silently no-op in dev; verify via
  DevTools → Application → Storage if curious.
- SAF folder listings can be slow on huge trees (DocumentsContract).
