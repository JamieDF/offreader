import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import type { Driver } from 'driver.js';
import { storageService } from '@/services/storage';

const TOUR_COMPLETED_KEY = 'offreader-tour-completed';
const LAST_VISIT_KEY = 'offreader-last-visit';

export interface DemoState {
  /** True while the tour is on the import dialog step. */
  dialogOpen: boolean;
  /** True while the tour is on the demo book card step. */
  bookCardVisible: boolean;
  /** Fake book rendered into the library grid while bookCardVisible is true. */
  fakeBookId: string | null;
  selectedShelfId: string | null;
  selectedLabelIds: string[];
}

const EMPTY_DEMO_STATE: DemoState = {
  dialogOpen: false,
  bookCardVisible: false,
  fakeBookId: null,
  selectedShelfId: null,
  selectedLabelIds: [],
};

export interface UseOnboardingTourResult {
  isOpen: boolean;
  hasCompleted: boolean;
  demoState: DemoState;
  /** ID of the active driver step, or null when no tour is running. */
  currentStep: string | null;
  start: () => void;
  /**
   * Force-open the tour regardless of `hasCompleted`. Also clears the
   * persisted completion marker so a future auto-launch would work too.
   * Used by the "Take the tour" replay entry on the About page.
   */
  forceStart: () => Promise<void>;
  stop: () => Promise<void>;
  /** Called by the OnboardingTour controller to register its driver
   *  instance so imperative tour navigation (moveNext) can happen from
   *  LibraryView via the demo helpers below. */
  setDriverRef: (d: Driver | null) => void;
  /** Step 2 → 3: open the demo import dialog. LibraryView watches
   *  demoState.dialogOpen and renders the dialog with the fake book. */
  startDemoImport: () => void;
  /** Step 3 → 4: called by PostImportDialog.onConfirm in demo mode.
   *  Stores the user's shelf/label selection and reveals the fake book
   *  card so the next step has an anchor. */
  applyDemoImport: (shelfId: string | null, labelIds: string[]) => void;
  /** Tour cleanup: hide the fake dialog/card and clear demo state. */
  endDemo: () => void;
  /** Controller-only: report the active step so consumers (LibraryView)
   *  can react (e.g. open the mobile settings menu on step 6). */
  setCurrentStep: (stepId: string | null) => void;
}

const OnboardingTourContext = createContext<UseOnboardingTourResult | undefined>(undefined);

/**
 * Single source of truth for the first-run onboarding tour.
 * Spans all routes (controller lives in App.tsx; replay triggers live in
 * the Welcome dialog and the About page).
 *
 * Auto-start rule: fresh install only (no last-visit AND no tour-completed).
 * Returning users don't see it automatically — they replay from About
 * or the Welcome dialog.
 */
export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>(EMPTY_DEMO_STATE);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  // Driver instance is owned by the OnboardingTour controller. We hold a
  // ref here so demo helpers (called from LibraryView, outside the
  // controller's React tree) can call driver.moveNext().
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    async function check() {
      const completed = await storageService.getItem(TOUR_COMPLETED_KEY);
      setHasCompleted(completed !== null);
      // The tour never auto-launches. It is started explicitly from
      // the welcome dialog's "Start the tour" button or from the
      // About page's replay entry.
    }

    check();
  }, []);

  const start = useCallback(() => {
    setIsOpen(true);
  }, []);

  const forceStart = useCallback(async (): Promise<void> => {
    // Clear the persisted completion marker so the auto-launch path on
    // next install would also work, then open the tour regardless of
    // any prior completion.
    await storageService.removeItem(TOUR_COMPLETED_KEY);
    setHasCompleted(false);
    setIsOpen(true);
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    setIsOpen(false);
    setHasCompleted(true);
    setDemoState(EMPTY_DEMO_STATE);
    setCurrentStep(null);
    await storageService.setItem(TOUR_COMPLETED_KEY, new Date().toISOString());
  }, []);

  const setDriverRef = useCallback((d: Driver | null) => {
    driverRef.current = d;
  }, []);

  const startDemoImport = useCallback(() => {
    setDemoState(prev => ({
      ...prev,
      dialogOpen: true,
      bookCardVisible: false,
      fakeBookId: 'tour-demo-book',
      selectedShelfId: null,
      selectedLabelIds: [],
    }));
    // Note: the controller's onNextClick for the 'import' step calls
    // driver.moveNext() on a delay after this. Doing it here would race
    // with the dialog's Radix portal mount.
  }, []);

  const applyDemoImport = useCallback((shelfId: string | null, labelIds: string[]) => {
    setDemoState(prev => ({
      ...prev,
      dialogOpen: false,
      bookCardVisible: true,
      selectedShelfId: shelfId,
      selectedLabelIds: labelIds,
    }));
    // The controller's onNextClick for the dialog steps calls
    // driver.moveNext() on a delay after this so the demo card has time
    // to render before the next spotlight tries to find it.
  }, []);

  const endDemo = useCallback(() => {
    setDemoState(EMPTY_DEMO_STATE);
  }, []);

  return (
    <OnboardingTourContext.Provider
      value={{
        isOpen,
        hasCompleted,
        demoState,
        currentStep,
        start,
        forceStart,
        stop,
        setDriverRef,
        startDemoImport,
        applyDemoImport,
        endDemo,
        setCurrentStep,
      }}
    >
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): UseOnboardingTourResult {
  const context = useContext(OnboardingTourContext);
  if (context === undefined) {
    throw new Error('useOnboardingTour must be used within an OnboardingTourProvider');
  }
  return context;
}