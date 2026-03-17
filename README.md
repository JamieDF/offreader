# 📚 eTome - Premium Ebook Reader

A modern, feature-rich digital ebook reader for web and mobile platforms built with React, Vite, and Foliate-js.

## 🎯 Quick Overview

**eTome** is a professional-grade ebook reader application that supports EPUB and MOBI formats with advanced features like bookmarks, reading progress tracking, customizable typography, multiple themes, and cross-session persistence.

- **Platforms**: Web (Vite/React) + Android (Capacitor)
- **Formats**: EPUB, MOBI with automatic format detection
- **Status**: ✅ Production-ready (72 tests, all passing)

---

## ✨ Core Features

### 📖 Reading Experience
- **Foliate-js Engine**: Modern EPUB rendering with no iframe overhead
- **Direct DOM Rendering**: Premium styling and performance
- **Full-Screen Mode**: Immersive reading on mobile and desktop
- **Responsive Layout**: Optimized for all screen sizes
- **Stable Viewport**: Non-scrollable fixed layout to prevent shifting during overlay interactions

### 🎨 Customization
- **7 Themes**: Light, Dark, Sepia, OLED + 3 genre themes (Fantasy, Cyberpunk, Noir)
- **Typography Controls**: Font families (7), size, line height, margins, paragraph spacing
- **Real-time Application**: Changes apply instantly to book content
- **Persistent Settings**: All preferences saved across sessions

### 📑 Navigation & Interaction
- **Page Turning**: Buttons, swipe/drag gestures with foliate-js animations
- **Smart Tap-to-Toggle**: Single tap anywhere on book content to show/hide UI overlay
- **Foliate Overlayer Integration**: Proper integration with foliate-js overlay system
- **Touch-Friendly**: Mobile-optimized interface with proper viewport scaling
- **Chapter Navigation**: Quick jump to chapters
- **Title Formatting**: Professional title case for all book titles (with proper stop word handling)

### 📚 Content Management
- **Book Library**: Grid view with cover images and progress indicators
- **Book Import**: File picker for EPUB/MOBI files with auto-detection
- **Book Details**: Hero section with metadata, reading stats, publication info
- **Resume Reading**: Jump back to last read location or specific chapter

### 🔖 Bookmarks
- **Create & Manage**: Add bookmarks while reading with timestamps
- **Navigation**: Jump to bookmarked locations from reader or book details
- **Persistent Storage**: Bookmarks saved to localStorage
- **Mobile-First UI**: Always-visible delete buttons (no hover needed)

### 📊 Reading Progress
- **Automatic Tracking**: CFI-based location tracking with 0-100% progress
- **Resume Functionality**: "Read Now" resumes from exact saved position
- **Progress Display**: Clean percentage formatting (49% vs 49.01%)
- **Dual Systems**: Both library and book details show synchronized progress

### 📖 Metadata Extraction
- **EPUB Support**: Comprehensive OPF parsing for title, author, publisher, publication date, language, ISBN
- **MOBI Support**: Binary EXTH header parsing with proper endianness handling
- **Smart Descriptions**: Multiple fallback methods with informative defaults
- **Subject Tags**: Genre/subject tags displayed as styled badges
- **Cover Extraction**: 4-tier fallback strategy for both EPUB and MOBI (100% coverage)

### 📊 Reading Statistics & Analytics
- **Time Tracking**: Automatic session duration and total reading time
- **Activity Heatmap**: Visual representation of reading patterns
- **Reading Streaks**: Current streak and longest streak tracking
- **Daily Stats**: Aggregated reading data by day
- **Session Details**: Start/end times, locations, progress tracking
- **Insights Dashboard**: Total time, streaks, session count, recent activity

### 🔍 Library Management
- **Search**: Search books by title or author name
- **Sorting**: Multiple sort options (Recently Read, Title, Author, Progress)
- **Smart Filtering**: Results update in real-time as you search/sort

### 🛠️ Technical Features
- **Dual Format Support**: EPUB and MOBI with automatic detection
- **Cross-Session Persistence**: Capacitor Filesystem for stable storage
- **UUID System**: Stable book identification independent of file paths
- **Proper Text Cleaning**: Null byte and control character removal
- **Error Handling**: Graceful fallbacks for non-standard file structures

---

## 🏗️ Architecture

### State Management Pattern
```
App.tsx (Route Guard) → LibraryService (Singleton) 
  → useLibrary (Subscribers) → Components
```

**Key Components:**
- **LibraryService**: Centralized singleton managing all book state
- **updateBooks()**: Notifies all subscribers (imports/deletions)
- **updateBooksSilent()**: No notifications (prevents infinite loops on progress updates)
- **useLibrary Hook**: Subscribes to changes, breaks circular dependencies

### Progress Tracking
```
Foliate relocate event → EpubReader 
  → updateProgress (useBookTracker) + updateLibraryProgress (useLibrary)
```

- **useBookTracker**: CFI locations, bookmarks, reading stats per book
- **useLibrary**: Book percentages for library view
- **Synchronization**: Both systems stay in sync automatically

### Storage Architecture
- **Books**: `"etome-books"` (localStorage) + Capacitor Filesystem (persistent files)
- **Progress**: `"book-tracker-data"` (single localStorage object for all books)
- **Settings**: `"reader-settings"` (theme, typography, preferences)
- **Rehydration**: File URLs rehydrated on app start via Capacitor

### Anti-Patterns Avoided
- ✅ No multiple useLibrary instances (single source of truth)
- ✅ No progress updates triggering re-initialization (silent updates)
- ✅ No circular dependencies (removed state dependencies in callbacks)
- ✅ No inconsistent storage keys (standardized patterns)
- ✅ No binary data corruption (proper text cleaning)
- ✅ No metadata extraction failures (multiple fallback strategies)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ with npm

### Installation
```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd foliate-reader-test

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run test          # Run test suite
npm test -- --watch  # Run tests in watch mode
npm run lint          # Run ESLint

# Mobile (Capacitor)
npm run cap:build    # Build for Capacitor
npm run cap:sync     # Sync to native platform
npm run cap:android  # Run on Android
```

---

## 🧪 Testing

**72 tests against real source code:**
- Pure utility functions (statsCalculator, titleCase) - 31 tests
- Hook behaviour (useReadingStats, useBookTracker) - 25 tests
- Service layer (LibraryService, fileStorage) - 15 tests
- Example - 1 test

**All tests passing ✅**

```bash
npm test
# Test Files: 7 passed (7)
# Tests: 72 passed (72)
# Duration: ~1.5s
```

See **Tests.md** for comprehensive test documentation.

---

## 📦 Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (fast, modern)
- **UI Components**: Shadcn UI (Radix + Tailwind CSS)
- **Styling**: Tailwind CSS with custom themes
- **Icons**: Lucide React
- **Routing**: React Router DOM

### EPUB/MOBI Processing
- **EPUB Engine**: Foliate-js (no iframe rendering)
- **ZIP Parsing**: JSZip for EPUB file handling
- **Binary Parsing**: Custom MOBI header/EXTH tag extraction
- **XML Parsing**: Built-in XML APIs for OPF metadata

### Storage & Platform
- **Mobile Bridge**: Capacitor (Android native bridge)
- **File Storage**: Capacitor Filesystem (web + native)
- **Preferences**: Capacitor Preferences (web + native)
- **Metadata**: localStorage for rapid access

### Development
- **Testing**: Vitest with comprehensive test utilities
- **Linting**: ESLint
- **Type Safety**: Full TypeScript support

---

## 📋 Project Structure

```
src/
├── hooks/
│   ├── useLibrary.ts (1,661 lines - main state management)
│   ├── useBookTracker.ts (progress & bookmarks)
│   ├── useReadingStats.ts (session tracking with race condition prevention)
│   └── use-mobile.tsx (responsive helper)
├── services/
│   ├── LibraryService.ts (singleton state with orphan cleanup)
│   ├── fileStorage.ts (file persistence with quota checking)
│   ├── storage.ts (localStorage abstraction)
│   └── sessionService.ts (session management)
├── components/
│   ├── EpubReader.tsx (820+ lines - main reader UI with foliate overlayer integration)
│   ├── ReaderHeader.tsx (controls & buttons)
│   ├── ReaderFooter.tsx (progress bar)
│   ├── reader/ (bookmarks, settings, navigation)
│   ├── library/ (grid view, cards, controls)
│   ├── book-details/ (hero, metadata, stats)
│   └── ui/ (shadcn components)
├── pages/
│   ├── Library.tsx (main library view)
│   ├── Reader.tsx (reading route)
│   ├── BookDetails.tsx (book information)
│   └── Index.tsx (landing page)
├── contexts/
│   └── ReaderSettingsContext.tsx (global theme & typography)
├── types/
│   └── book.ts (TypeScript interfaces)
├── utils/
│   ├── titleCase.ts (title formatting utility)
│   └── statsCalculator.ts (reading metrics)
├── test/
│   ├── hooks/ (feature tests)
│   ├── services/ (service tests)
│   ├── utils/ (test data generators)
│   └── setup.ts (test configuration)
└── index.css (themes, CSS variables, viewport lock)
```

---

## 🎯 Key Implementation Details

### EPUB Metadata Extraction
1. Parse OPF file from `META-INF/container.xml`
2. Extract comprehensive metadata (title, author, publisher, ISBN, etc.)
3. Parse description with multiple fallback methods
4. Extract subject tags and copyright information
5. Estimate chapters from spine items (60% heuristic)

### MOBI Binary Parsing
1. Read Palm Header at Record 0, offset 80
2. Find MOBI header position in PalmDOC structure
3. Validate MOBI signature at Start + 16
4. Check EXTH flag (bit 6) at Start + 128
5. Extract tags with proper 4-byte alignment
6. Clean null bytes and control characters

### Cover Extraction (4-Tier Fallback)
1. **Tier 1**: EPUB3 `properties="cover-image"` in OPF
2. **Tier 2**: EPUB2 `<meta name="cover">` tag
3. **Tier 3**: Fuzzy filename matching (cover*, front*, title*)
4. **Tier 4**: First single image on content page
5. **Output**: Base64 data URLs for persistent storage

### Foliate Overlayer Integration
1. **Event Hijacking**: Intercepts touch/click events inside foliate's document
2. **Smart Detection**: Distinguishes between taps (200ms, <10px movement) and drags
3. **Capture Phase**: Uses event capture to intercept before foliate processes events
4. **Cross-Platform**: Works with both touch events (mobile) and mouse events (desktop)
5. **Non-Intrusive**: Preserves foliate's native drag gestures for page turning

### Typography System
- CSS custom properties for real-time application
- Foliate-js renderer integration for instant updates
- 7 font families with fine-tuned controls
- Persistent settings with proper loading sequence

### Theme System
- HSL-based CSS variables for consistency
- Theme-aware toast notifications
- 3 immersive genre themes (Fantasy, Cyberpunk, Noir)
- Dynamic color schemes per theme

---

## 🔧 Configuration

### Capacitor Setup
- **App ID**: `com.etome.reader`
- **Platforms**: Android (iOS ready)
- **Plugins**: Filesystem, Preferences, Android

### Environment
```typescript
// src/types/book.ts
interface Book {
  id: string;
  file: File | Blob;
  fileURL: string;
  title: string;
  author: string;
  progress: number;
  currentLocation: string;
  chapters: number;
  format: 'epub' | 'mobi';
  // ... metadata fields
}
```

---

## ✅ Production Readiness Checklist

- ✅ Core reading experience fully implemented
- ✅ All 16 major features complete
- ✅ 72 tests, all passing
- ✅ 3 P1 critical fixes implemented (race condition, quota checking, metadata sync)
- ✅ Comprehensive error handling
- ✅ Mobile optimization
- ✅ Cross-session persistence
- ✅ Professional UI/UX (title case formatting, fixed viewport)
- ✅ Performance optimized
- ✅ Architecture stable (no infinite loops, no layout shifts)
- ✅ Documentation accurate

**Status**: 🟢 **READY FOR PRODUCTION**

---

## 📊 Feature Coverage Status

**Core Features**: ✅ 100% Complete
- Reading engine, bookmarks, progress tracking, metadata extraction, customization

**Library Management**: ✅ 100% Complete  
- Search, sorting, book import/removal

**Reading Statistics**: ✅ 100% Complete
- Time tracking, activity heatmap, streaks, daily stats

**Planned Enhancements**: Organized by priority
- See Future Enhancements section below

---

## 📚 Future Enhancements

### Short-term
- [ ] Component integration tests (EpubReader component)
- [ ] End-to-end workflow tests (import → library → read flow)
- [ ] Advanced search (full-text search within book content)
- [ ] Error recovery testing (corrupted files, storage quota)

### Medium-term
- [ ] Collection management (folders/tags for book organization)
- [ ] Performance optimization (large libraries, memory profiling)
- [ ] Metadata editing (allow users to edit book information)

### Long-term
- [ ] Cloud sync (cross-device reading progress)
- [ ] Social features (share highlights, reading progress)
- [ ] PDF support (in addition to EPUB/MOBI)
- [ ] Calibre library integration
- [ ] Advanced full-text search indexing

---

## 📄 License

[Add your license here]

---

## 🤝 Contributing

[Add contributing guidelines here]

---

**Last Updated**: March 2, 2026  
**Version**: 1.1 (Enhanced with Foliate Overlayer Integration)  
**Status**: ✅ All systems operational
