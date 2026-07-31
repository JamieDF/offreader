<p align="center">
  <img src="public/offReader.svg" width="120" alt="OffReader logo" />
</p>

<h1 align="center">OffReader</h1>

<p align="center">
  An offline ebook library and reader for web, Android, and Linux desktop. Open source. No account. Just your books.
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.offreader.reader"><img src="https://img.shields.io/badge/Google_Play-Get_it_on_Google_Play-green?logo=google-play&logoColor=white" alt="Get it on Google Play" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/version-1.0.3-blue.svg" alt="Version 1.0.3" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

OffReader is a personal ebook library and reader built around one idea: your books should live on your device, not a server. Import an EPUB, MOBI, or PDF file and read it; your progress, bookmarks, and reading history all stay local. It's free and [open source](LICENSE) under the MIT license.

It runs in the browser, as an [Android app on Google Play](https://play.google.com/store/apps/details?id=com.offreader.reader), or as a Linux desktop AppImage via Capacitor.

## Why

There are other great projects that do something similar, but I wanted to build my own: a simple, focused reading experience where you open a book and read it. No accounts, no setup. Just you and the page. The whole point is the reading.

---

## Features

- Import EPUB, MOBI, and PDF files from your device
- **Organize with Shelves**: assign each book to one shelf; create, rename, reorder, and delete shelves
- **Tag with Labels**: assign multiple colored labels per book; filter your library by shelf or labels
- **10+ reader themes** (light, sepia, dark, day, parchment, neon, noir, meadow, coast, storm) plus typography controls (font, size, line height, spacing)
- Per-chapter page tracking and overall progress
- Bookmarks with jump-to navigation
- **Full-text search**: search inside any book across EPUB, PDF, and MOBI; results show context with highlighted matches and click-to-navigate
- **Editable metadata**: fix titles, authors, and descriptions on any book; review and edit right after import
- Reading time tracking, streaks, and activity history
- **Reading Insights** dashboard with charts for time read, streaks, and activity
- Persistent library: your books survive a refresh or reboot
- CSP-enforced EPUB script blocking for security
- **In-app privacy policy**; no accounts, no analytics, and no data leaves your device
- Works fully offline; nothing is sent anywhere

---

## Data Storage

All books and settings stay on your device; nothing is uploaded anywhere.

| Platform | Book files | App data (settings, progress, library) |
|----------|-----------|----------------------------------------|
| **Web browser** | Browser's File System Access API or IndexedDB fallback | `localStorage` |
| **Android** | App's internal storage (`/data/data/com.offreader.reader/files/`) | `SharedPreferences` |
| **AppImage / Linux desktop** | IndexedDB blob store (`~/.config/OffReader/IndexedDB/capacitor-electron_-_0.indexeddb.blob/`) | `localStorage` via LevelDB (`~/.config/OffReader/Local Storage/`) |

To locate the actual storage on a Linux desktop:

```bash
# Book files (as IndexedDB blobs)
~/.config/OffReader/IndexedDB/capacitor-electron_-_0.indexeddb.blob/

# App settings, reading progress, library metadata
~/.config/OffReader/Local Storage/leveldb/
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (bundled with Node)

### Installation

```bash
git clone https://github.com/jamiedf/offreader.git
cd offreader
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Tap **Import Book** and select an EPUB, MOBI, or PDF file to get started.

---

## Usage

| Action | How |
|---|---|
| Import a book | Tap the **Import Book** button and pick a file |
| Open a book | Tap its card in the library |
| Assign a shelf | Tap the **Shelf** button on the book detail page |
| Add labels | Tap the **+** button next to Labels on the book detail page |
| Organize library | Open **Manage Library** from settings to create/edit shelves and labels |
| Navigate pages | Arrow keys, swipe, or the on-screen buttons |
| Show controls | Tap anywhere on the page |
| Change theme / font | Open settings from the reader toolbar |
| View reading stats | Open the book detail page |

---

## Running the Tests

```bash
npm test              # Unit tests (Vitest)
npm run test:e2e      # End-to-end browser tests (Playwright)
npm run test:all      # Both suites
```

Unit tests cover utility functions, parsers, service layer, and hook behaviour.
E2E tests run against a real browser; Chromium is required (`npx playwright install chromium`).

---

## Built With

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/): UI framework
- [Vite](https://vitejs.dev/): build tool
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/): styling and components
- [foliate-js](https://github.com/JamieDF/foliate-js): EPUB/MOBI/PDF rendering engine (Vite-compatible fork)
- [PDF.js](https://mozilla.github.io/pdf.js/): PDF rendering (via pdfjs-dist)
- [Capacitor](https://capacitorjs.com/): Android/iOS/Linux bridge and native storage
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/): testing

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Versioning

OffReader uses [Semantic Versioning](https://semver.org/). For available releases, see the [tags on this repository](../../tags).

---

## Authors

- **JamieDF**: development

See also the list of [contributors](../../contributors) who have participated in this project.

## Acknowledgments

- [foliate-js](https://github.com/johnfactotum/foliate-js) by johnfactotum, the rendering engine that makes this possible, forked at [JamieDF/foliate-js](https://github.com/JamieDF/foliate-js) to add Vite compatibility and PDF zoom/pan improvements
- [Project Gutenberg](https://www.gutenberg.org/): public domain ebooks used in tests
- [PurpleBooth](https://gist.github.com/PurpleBooth/109311bb0361f32d87a2): README template

---

## License

This project is licensed under the MIT License; see the [LICENSE](LICENSE) file for details.

---

## Project Status

Active development. Core reading experience is stable. See [open issues](../../issues) for known limitations and planned work.
