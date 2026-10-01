# Storage & Sync Roadmap

Status: in progress on `storage-rework`. Stages 0–2 landed (uncommitted at time
of writing). This document captures the design decisions for the book-file
storage rework and folder-sync features.

**Stage status**: 0 ✅ persist+revoke · 1 ✅ content-addressed binary store ·
2 ✅ linked-mode plumbing (Electron) · 3 folder sync · 4 follow-ons

Stage 2 details as implemented: the `offreader-file://` scheme is registered
privileged (`supportFetchAPI`, `stream`) in `electron/src/index.ts`; a
main-process allowlist (`allowedFilePaths`) is populated via the
`offreader:register-file-path` IPC before any fetch, and `protocol.handle`
403s anything not registered. Linked-book reads go through
`fileStorage.retrieveBookBlob(book)` → `retrieveLinkedBlob(sourcePath)` →
`fetch(offreader-file://file/?p=<path>)`. Missing linked books are kept in
the library with `Book.missing` and the reader offers a relink picker
(`useLibrary.relinkBook`, which re-hashes the new file). The import-mode
setting lives at `offreader-import-mode` (`src/utils/importMode.ts`) and is
surfaced in `ImportModeDialog` (per-import choice) and `ManageLibrary`
(default).

## Current architecture

Every book is stored as two disconnected pieces joined only by the book's UUID:

- **Metadata**: `Book` records serialized as one JSON array under the
  `offreader-books` Capacitor Preferences key. Every save rewrites the entire array.
- **File bytes**: `Documents/books/<uuid>.<ext>` written via Capacitor
  `Filesystem.writeFile` in `src/services/fileStorage.ts`.

`Filesystem.writeFile`/`readFile` transport data as **base64 strings** because the
JS↔native bridge serializes JSON. The web shim persists that base64 string into
IndexedDB; on Android/Electron the plugin writes a real binary file.

## Known problems (audit)

- **+33% size tax persisted on web** — IndexedDB stores the base64 string itself.
  `checkStorageQuota` bakes this in (`fileSize * 1.33`).
- **~3–4 transient copies on open** — base64 string → `atob` → `Uint8Array` →
  Blob → object URL → `fetch` → another Blob → `File` for foliate
  (`BookReader.tsx` ~line 351). A 50MB CBZ spikes 200MB+.
- **`charCodeAt` decode loop** — O(n) JS loop, ~66M iterations for a 50MB file,
  seconds of jank on mobile. It's the standard base64→Blob idiom forced by the
  API; the fix is not decoding at all.
- **Blob URLs never revoked** — `revokeObjectURL` appears nowhere; every opened
  book keeps its full blob alive for the session.
- **No dedup** — filename key is `uuidv4()` per import; the same file imported
  twice is stored twice.
- **`filePath` is vestigial** — stored on `Book`, blanked at init, never read.
  `fileExists` probes up to 6 extensions per book at startup instead.
- **Whole-library JSON rewrite per op** — every progress tick re-serializes all
  book metadata. Fine at ~50 books, wasteful at 500.
- **No `navigator.storage.persist()`** — the entire web-library is evictable
  under browser disk pressure. "My books disappeared" failure mode.
- **Android files land in public `Documents/books/<uuid>.ext`** — visible in
  file managers' recent-files views. A user can delete an anonymous-UUID file
  → next launch drops the book silently (progress included). Public Documents
  files can also linger after uninstall and aren't covered by Auto Backup.
- **`retrieveFile` swallows errors** — corrupted file looks like "not found".

## Target design

1. **Content-addressed storage**: `books/<sha256>.<ext>`. Dedup and sync-detection
   become filename lookups; integrity is verifiable; folder reorgs don't break
   identity (a moved file re-found by hash just updates `sourcePath`).
2. **Binary-native storage per platform**, behind one interface
   (`getBookUrl(id) → url`):
   - Web/Electron: raw `Blob` in IndexedDB → `createObjectURL` direct.
   - Native: keep binary files; on open use `Filesystem.getUri` +
     `Capacitor.convertFileSrc` so the WebView streams from disk — no bridge
     copy, no base64.
   - Electron linked books: custom protocol (`offreader-file://`) via
     `protocol.handle` streaming from disk — enables pdfjs range requests.
3. **`Book.source: 'managed' | 'linked'` + `sourcePath`** — mode is a property
   of the book's bytes, not the library. Mixed libraries are normal.
4. **Revoke blob URLs** on reader unmount.
5. **`navigator.storage.persist()`** on web/Electron.
6. **Android: `Directory.Data` (app-private)** instead of `Directory.Documents`
   — invisible to file managers, cleaned on uninstall, covered by Auto Backup.
   Migration moves existing files on first launch.
7. **Per-book metadata store** (IndexedDB keys or SQLite) — later; makes progress
   ticks cheap.
8. **Read-through cache** acceptable for slow linked sources (SAF content URIs).

## Configurable import mode

- Setting (desktop-only section): "Import mode: Link in place / Copy into
  library". **Electron default: linked.** Web hides it entirely (capability,
  not preference).
- Per-import override checkbox, iTunes-style ("Copy files to library" model).
- Folder sync is always linked by definition.
- **Asymmetric conversion**: linked→managed is possible ("Move into library"
  action — good multi-select bulk op); managed→linked is impossible (no source
  path exists). The setting only affects *new* imports; existing books keep
  their mode.
- Linked default assumes the curated-folder user (e.g. 100GB+ Calibre-style
  library); its failure flavor is "file moved → relink or remove" UI.

## Platform notes

- **Web**: copy-only, always. Browsers can't durably reference arbitrary files.
  The 100GB-library use case is a desktop feature.
- **Electron**: linked sync = `dialog.showOpenDialog` + index + `fs.watch`.
  Cheapest linked implementation — do it first.
- **Android**: linked mode possible via SAF `ACTION_OPEN_DOCUMENT_TREE` +
  persisted URI permission, but needs a custom Capacitor plugin (Filesystem
  doesn't expose document trees). More revocation surfaces (folder rename, SD
  eject, reinstall) and slower enumeration. Phase after Electron. Also
  motivated by the self-documenting-filename benefit.
- Hashing a huge library on first index takes real time (disk-bound) — hash
  lazily or use path+size+mtime as fast identity with hash as upgrade.

## Roadmap

1. Storage rework: hash keys, binary/blob storage, `source`/`sourcePath`,
   private Android dir, blob-URL revocation, `storage.persist()`, migration
   pass (alongside existing `migrateExtensions`/`cleanupOrphanFiles` slot in
   `LibraryService.initialize`), friendly "already imported" duplicate UX.
2. Folder-sync imports (Electron): pick folders → index → watch/rescan →
   linked books.
3. Android SAF plugin (linked mode on Android).
4. Follow-ons enabled by hash identity: "Open with" file associations,
   library backup/export (copy `books/` + metadata JSON), "Move into library"
   bulk action.

## Context

User motivation: a 100GB+ existing epub/pdf library — copying it into managed
storage is a non-starter, which is why linked mode is a first-class design
constraint rather than a later nicety.
