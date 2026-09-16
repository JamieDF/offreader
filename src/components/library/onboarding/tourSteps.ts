import type { Side, Alignment } from 'driver.js';

export type TourSide = Side;
export type TourAlign = Alignment;

export interface TourStep {
  id: string;
  /**
   * Selector for the spotlight anchor. May be a CSS selector string, a
   * function returning an Element, or a function returning null (which
   * triggers driver.js's centered welcome-screen mode with no spotlight).
   */
  targetSelector: string | (() => Element | null);
  title: string;
  body: string;
  /** Side of the anchor the popover attaches to. Driver.js will auto-flip
   *  to a sensible side if the requested one doesn't fit. */
  side?: TourSide;
  /** How the popover aligns along the axis perpendicular to its side. */
  align?: TourAlign;
  /** Milliseconds to wait for the selector to resolve before giving up. */
  waitForElement?: number;
}

/**
 * Spotlight the entire right-side header cluster. On desktop this
 * covers Manage Library, Reading Insights, Settings, and About. On
 * mobile it covers Sort, Search, and the Menu trigger.
 */
function pickSettingsTarget(): Element {
  if (typeof document === 'undefined') {
    return (globalThis as unknown as { document: { body: Element } }).document.body;
  }
  const headerCluster = document.querySelector('[data-tour="library-header"]');
  if (headerCluster && (headerCluster as HTMLElement).offsetParent !== null) {
    return headerCluster;
  }
  return document.body;
}

/**
 * First-run onboarding tour. Six steps, all on the Library page.
 *
 * Steps 3 and 4 use demo state managed by useOnboardingTour. The Library
 * view renders a fake book + PostImportDialog when the tour asks for it;
 * nothing is persisted to libraryService.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    // Returning null triggers driver.js's centered welcome mode with a
    // fully-dimmed page (no specific anchor to spotlight).
    targetSelector: () => null,
    title: 'Take the guided tour',
    body: 'A quick tour of the basics. Takes about 30 seconds. You can skip any time.',
  },
  {
    id: 'import',
    targetSelector: '[data-tour="fab"]',
    title: 'Add a book',
    body: 'ADD_BOOK_INTRO|EPUB|MOBI|AZW3|FB2|CBZ|PDF',
    side: 'left',
    align: 'center',
  },
  {
    id: 'dialog-metadata',
    targetSelector: '[data-tour="import-dialog-metadata"]',
    title: 'Edit the new book',
    body: 'Review and adjust the title, author, and description before it joins your library.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'dialog-shelf',
    targetSelector: '[data-tour="import-dialog-shelf"]',
    title: 'Set a shelf and a label',
    body: 'Shelves group books by project. Labels tag them by mood or genre. Tap Next when ready.',
    side: 'left',
    align: 'end',
  },
  {
    id: 'book-card',
    targetSelector: '[data-tour="demo-book-card"]',
    title: 'Open a book',
    body: 'Tap a book to open its details, then start reading. We will cover the reader next.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'settings',
    targetSelector: pickSettingsTarget,
    title: 'Settings',
    body: 'SORT_SEARCH_MANAGE_LIBRARY|Appearance and Settings (theme, font, accessibility)|Reading Insights|About',
    side: 'bottom',
    align: 'end',
  },
];