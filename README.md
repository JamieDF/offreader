<p align="center">
  <img src="public/offReader.svg" width="120" alt="OffReader logo" />
</p>

<h1 align="center">OffReader</h1>

<p align="center">
  An offline ebook reader for web and Android. No account. No cloud. Just your books.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version 0.1.0" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
</p>

---

OffReader is a personal ebook reader built around one idea: your books should live on your device, not a server. Import an EPUB or MOBI file, read it, and everything — progress, bookmarks, reading history — stays local.

It runs in the browser and can be installed as an Android app via Capacitor.

## Why

There are other great projects that do something similar, but I wanted to build my own — a simple, focused reading experience where you open a book and read it. No accounts, no cloud, no setup. Just you and the page. The whole point is the reading.

---

## Features

- Import EPUB and MOBI files from your device
- Themes and typography controls (font, size, line height, spacing)
- Per-chapter page tracking and overall progress
- Bookmarks with jump-to navigation
- Reading time tracking, streaks, and activity history
- Persistent library — your books survive a refresh or reboot
- CSP-enforced EPUB script blocking for security
- Works fully offline; nothing is sent anywhere

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

Open [http://localhost:5173](http://localhost:5173) in your browser. Tap **Import Book** and select an EPUB or MOBI file to get started.

---

## Usage

| Action | How |
|---|---|
| Import a book | Tap the **Import Book** button and pick a file |
| Open a book | Tap its card in the library |
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

Unit tests cover utility functions, service layer, and hook behaviour.
E2E tests run against a real browser — Chromium is required (`npx playwright install chromium`).

---

## Built With

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI framework
- [Vite](https://vitejs.dev/) — build tool
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — styling and components
- [foliate-js](https://github.com/johnfactotum/foliate-js) — EPUB/MOBI rendering engine
- [Capacitor](https://capacitorjs.com/) — Android bridge and native file storage
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) — testing

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Versioning

OffReader uses [Semantic Versioning](https://semver.org/). For available releases, see the [tags on this repository](../../tags).

---

## Authors

- **JamieDF** — initial development

See also the list of [contributors](../../contributors) who have participated in this project.

## Acknowledgments

- [foliate-js](https://github.com/johnfactotum/foliate-js) by johnfactotum — the rendering engine that makes this possible
- [Project Gutenberg](https://www.gutenberg.org/) — public domain ebooks used in tests
- [PurpleBooth](https://gist.github.com/PurpleBooth/109311bb0361f32d87a2) — README template

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Project Status

Active development. Core reading experience is stable. See [open issues](../../issues) for known limitations and planned work.
