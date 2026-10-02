# Storage & Sync Roadmap

Status: complete on `storage-rework`: all stages landed, committed, and
pushed. This document captures the design decisions for the book-file
storage rework and folder-sync features.

**Stage status**: 0 ✅ persist+revoke · 1 ✅ content-addressed binary store ·
2 ✅ linked-mode plumbing (Electron) · 3 ✅ folder sync (Electron) ·
4 ✅ follow-ons (Move-into-library bulk action, open-with associations,
export/backup, Android SAF plugin: compile-verified, not device-tested)

Stage 3 details as implemented: `offreader:scan-folder` walks a directory
recursively for book extensions; `offreader:watch-folder` uses chokidar
(`fs.watch` isn't recursive on Linux) and debounces into
`offreader:folder-changed` renderer events. `src/services/folderSync.ts`
owns the algorithm: known sourcePaths skip re-hashing, unknown files are
read once: a hash match on a linked book repoints `sourcePath` (moved
file), on a managed book means "already have it", otherwise the file
imports via the shared pipeline in `bookImport.ts`. Unseen paths under a
watched folder flag their books `missing`. Folders persist under
`offreader-sync-folders` and are managed in `ManageLibrary`; `LibraryView`
starts watchers + a startup rescan after `libraryService.initialize`.

Stage 4 details as implemented:
- **Move into library**: `folderSync.moveBooksToLibrary(ids)` copies linked
  bytes into the store and flips `source` to 'managed' (source file
  untouched, sourcePath kept as provenance). SelectionActionBar shows the
  action when the selection has linked books.
- **Open with**: `fileAssociations` in electron/package.json; argv /
  `second-instance` / macOS `open-file` queue into `pendingOpenFiles`,
  pulled by the renderer via `offreader:take-pending-files` (pull avoids
  launch-timing races); `offreader:files-opened` nudges while running.
- **Export**: `src/services/exportLibrary.ts` writes `Title - Author.ext`
  per book plus `offreader-library.json` manifest into a picked dir;
  linked books copy natively (`export-copy-file`), managed stream out of
  IndexedDB (`export-write-file`).
- **Android SAF**: `OffreaderFilesPlugin.java` (pickDirectory → persisted
  document-tree permission, pickDocument for relink, listFiles tree walk,
  fileExists/statFile, resolveToCache read-through). `sourcePath` stores
  content:// URIs on Android; folderSync dispatches on platform and
  `isUnderFolder` tests doc-id prefixes; SAF has no watch primitive so
  Android rescans on app open.

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

- **+33% size tax persisted on web**: IndexedDB stores the base64 string itself.
  `checkStorageQuota` bakes this in (`fileSize * 1.33`).
- **~3-4 transient copies on open**: base64 string → `atob` → `Uint8Array` →
  Blob → object URL → `fetch` → another Blob → `File` for foliate
  (`BookReader.tsx` ~line 351). A 50MB CBZ spikes 200MB+.
- **`charCodeAt` decode loop**: O(n) JS loop, ~66M iterations for a 50MB file,
  seconds of jank on mobile. It's the standard base64→Blob idiom forced by the
  API; the fix is not decoding at all.
- **Blob URLs never revoked**: `revokeObjectURL` appears nowhere; every opened
  book keeps its full blob alive for the session.
- **No dedup**: filename key is `uuidv4()` per import; the same file imported
  twice is stored twice.
- **`filePath` is vestigial**: stored on `Book`, blanked at init, never read.
  `fileExists` probes up to 6 extensions per book at startup instead.
- **Whole-library JSON rewrite per op**: every progress tick re-serializes all
  book metadata. Fine at ~50 books, wasteful at 500.
- **No `navigator.storage.persist()`**: the entire web-library is evictable
  under browser disk pressure. "My books disappeared" failure mode.
- **Android files land in public `Documents/books/<uuid>.ext`**: visible in
  file managers' recent-files views. A user can delete an anonymous-UUID file
  → next launch drops the book silently (progress included). Public Documents
  files can also linger after uninstall and aren't covered by Auto Backup.
- **`retrieveFile` swallows errors**: corrupted file looks like "not found".

## Target design

1. **Content-addressed storage**: `books/<sha256>.<ext>`. Dedup and sync-detection
   become filename lookups; integrity is verifiable; folder reorgs don't break
   identity (a moved file re-found by hash just updates `sourcePath`).
2. **Binary-native storage per platform**, behind one interface
   (`getBookUrl(id) → url`):
   - Web/Electron: raw `Blob` in IndexedDB → `createObjectURL` direct.
   - Native: keep binary files; on open use `Filesystem.getUri` +
     `Capacitor.convertFileSrc` so the WebView streams from disk: no bridge
     copy, no base64.
   - Electron linked books: custom protocol (`offreader-file://`) via
     `protocol.handle` streaming from disk: enables pdfjs range requests.
3. **`Book.source: 'managed' | 'linked'` + `sourcePath`**: mode is a property
   of the book's bytes, not the library. Mixed libraries are normal.
4. **Revoke blob URLs** on reader unmount.
5. **`navigator.storage.persist()`** on web/Electron.
6. **Android: `Directory.Data` (app-private)** instead of `Directory.Documents`
  : invisible to file managers, cleaned on uninstall, covered by Auto Backup.
   Migration moves existing files on first launch.
7. **Per-book metadata store** (IndexedDB keys or SQLite): later; makes progress
   ticks cheap.
8. **Read-through cache** acceptable for slow linked sources (SAF content URIs).

## Configurable import mode

- Setting (desktop-only section): "Import mode: Link in place / Copy into
  library". **Electron default: linked.** Web hides it entirely (capability,
  not preference).
- Per-import override checkbox, iTunes-style ("Copy files to library" model).
- Folder sync is always linked by definition.
- **Asymmetric conversion**: linked→managed is possible ("Move into library"
  action: good multi-select bulk op); managed→linked is impossible (no source
  path exists). The setting only affects *new* imports; existing books keep
  their mode.
- Linked default assumes the curated-folder user (e.g. 100GB+ Calibre-style
  library); its failure flavor is "file moved → relink or remove" UI.

## Platform notes

- **Web**: copy-only, always. Browsers can't durably reference arbitrary files.
  The 100GB-library use case is a desktop feature.
- **Electron**: linked sync = `dialog.showOpenDialog` + index + `fs.watch`.
  Cheapest linked implementation: do it first.
- **Android**: linked mode possible via SAF `ACTION_OPEN_DOCUMENT_TREE` +
  persisted URI permission, but needs a custom Capacitor plugin (Filesystem
  doesn't expose document trees). More revocation surfaces (folder rename, SD
  eject, reinstall) and slower enumeration. Phase after Electron. Also
  motivated by the self-documenting-filename benefit.
- Hashing a huge library on first index takes real time (disk-bound): hash
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

## Deferred work

Not done; deliberate follow-ups once the core lands:

- **Per-book metadata store**: `offreader-books` is still one JSON array
  rewritten on every save (progress ticks serialize the whole library). Fine
  at ~50 books, wasteful at 500+. Move to per-book records (IndexedDB keys or
  SQLite). The audit entry above describes the problem.
- **Lazy hashing for large folder indexing**: the folder scan currently reads
  + hashes every unknown file eagerly. For a 100GB+ initial index this is
  disk-bound and slow; stage the fast identity (path+size+mtime) and hash
  in the background. See "Platform notes".
- **SAF device validation**: the Android plugin compiles but URI permission
  persistence, tree listing, and `resolveToCache` on large files are
  untested on real hardware.

## Context

User motivation: a 100GB+ existing epub/pdf library: copying it into managed
storage is a non-starter, which is why linked mode is a first-class design
constraint rather than a later nicety.
