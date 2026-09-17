/**
 * Tests for the onboarding tour hook — drives the first-run walkthrough,
 * persists completion state, and supports manual replay.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  OnboardingTourProvider,
  useOnboardingTour,
} from '@/hooks/useOnboardingTour';
import { storageService } from '@/services/storage';

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: vi.fn(),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

const mockGetItem = storageService.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = storageService.setItem as ReturnType<typeof vi.fn>;
const mockRemoveItem = storageService.removeItem as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  return <OnboardingTourProvider>{children}</OnboardingTourProvider>;
}

describe('useOnboardingTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not auto-start on fresh install', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    await waitFor(() => expect(result.current.hasCompleted).toBe(false));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.hasCompleted).toBe(false);
  });

  it('does NOT auto-start when tour-completed is set', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve('2026-01-01T00:00:00Z');
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasCompleted).toBe(true);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('does NOT auto-start when last-visit exists but tour-completed is missing', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      if (key === 'offreader-last-visit') return Promise.resolve('2026-01-01T00:00:00Z');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasCompleted).toBe(false);
    });
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.isOpen).toBe(false);
  });

  it('manual start() flips isOpen even after completion', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve('2026-01-01T00:00:00Z');
      if (key === 'offreader-last-visit') return Promise.resolve('2026-01-01T00:00:00Z');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasCompleted).toBe(true);
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.start();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('stop() persists completion marker', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });
    await waitFor(() => expect(result.current.hasCompleted).toBe(false));

    act(() => result.current.start());
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.hasCompleted).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      'offreader-tour-completed',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });

  it('start() works after stop() (no stacked state)', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });
    await waitFor(() => expect(result.current.hasCompleted).toBe(false));

    act(() => result.current.start());
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.start();
    });
    expect(result.current.isOpen).toBe(true);
  });
});

describe('useOnboardingTour demo state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('startDemoImport opens the demo dialog with a fake book id', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    act(() => {
      result.current.startDemoImport();
    });

    expect(result.current.demoState.dialogOpen).toBe(true);
    expect(result.current.demoState.bookCardVisible).toBe(false);
    expect(result.current.demoState.fakeBookId).toBe('tour-demo-book');
    expect(result.current.demoState.selectedShelfId).toBeNull();
    expect(result.current.demoState.selectedLabelIds).toEqual([]);
  });

  it('applyDemoImport hides the dialog and shows the fake card with selections persisted', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    act(() => {
      result.current.startDemoImport();
    });

    act(() => {
      result.current.applyDemoImport('shelf-123', ['label-a', 'label-b']);
    });

    expect(result.current.demoState.dialogOpen).toBe(false);
    expect(result.current.demoState.bookCardVisible).toBe(true);
    expect(result.current.demoState.fakeBookId).toBe('tour-demo-book');
    expect(result.current.demoState.selectedShelfId).toBe('shelf-123');
    expect(result.current.demoState.selectedLabelIds).toEqual(['label-a', 'label-b']);
  });

  it('endDemo clears fake book, dialog, card, and selections', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    act(() => {
      result.current.startDemoImport();
      result.current.applyDemoImport('shelf-123', ['label-a']);
    });
    expect(result.current.demoState.bookCardVisible).toBe(true);

    act(() => {
      result.current.endDemo();
    });

    expect(result.current.demoState).toEqual({
      dialogOpen: false,
      bookCardVisible: false,
      fakeBookId: null,
      selectedShelfId: null,
      selectedLabelIds: [],
    });
  });

  it('endDemo does not close the tour or clear completion', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });
    await waitFor(() => expect(result.current.hasCompleted).toBe(false));
    act(() => result.current.start());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.startDemoImport();
      result.current.applyDemoImport('s', ['l']);
      result.current.endDemo();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.hasCompleted).toBe(false);
  });

  it('setDriverRef registers and clears a driver instance', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    const fakeDriver = { moveNext: vi.fn() } as unknown as Parameters<typeof result.current.setDriverRef>[0];
    act(() => {
      result.current.setDriverRef(fakeDriver);
    });

    // startDemoImport flips demoState.dialogOpen. The controller's
    // onNextClick owns the moveNext scheduling now, so we just verify
    // state changes here and trust the controller wiring via e2e.
    act(() => {
      result.current.startDemoImport();
    });
    expect(result.current.demoState.dialogOpen).toBe(true);

    act(() => {
      result.current.setDriverRef(null);
    });
  });
});

describe('useOnboardingTour misc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('endDemo can be called without affecting the driver ref or isOpen', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    // Simulate the controller calling endDemo after the tour is
    // destroyed. The driver ref is the controller's responsibility;
    // endDemo should only reset demo state.
    const fakeDriver = { moveNext: vi.fn() } as unknown as Parameters<typeof result.current.setDriverRef>[0];
    act(() => {
      result.current.setDriverRef(fakeDriver);
      result.current.startDemoImport();
      result.current.applyDemoImport('shelf', ['label-a', 'label-b']);
      result.current.endDemo();
    });

    expect(result.current.demoState).toEqual({
      dialogOpen: false,
      bookCardVisible: false,
      fakeBookId: null,
      selectedShelfId: null,
      selectedLabelIds: [],
    });
    // fakeDriver is still in the ref slot; the controller's useEffect
    // cleanup sets it to null when isOpen flips false.
    expect(result.current.isOpen).toBe(false);
  });
});

describe('useOnboardingTour forceStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forceStart opens the tour and clears the completion marker', async () => {
    mockGetItem.mockImplementation(async (key: string) => {
      if (key === 'offreader-tour-completed') return Promise.resolve('2026-01-01T00:00:00Z');
      if (key === 'offreader-last-visit') return Promise.resolve('2026-01-01T00:00:00Z');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    await waitFor(() => expect(result.current.hasCompleted).toBe(true));
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      await result.current.forceStart();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.hasCompleted).toBe(false);
    expect(mockSetItem).not.toHaveBeenCalledWith('offreader-tour-completed', expect.anything());
    expect(mockRemoveItem).toHaveBeenCalledWith('offreader-tour-completed');
  });
});

describe('useOnboardingTour setCurrentStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts as null and updates to the reported step id', () => {
    mockGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useOnboardingTour(), { wrapper });

    expect(result.current.currentStep).toBe(null);

    act(() => {
      result.current.setCurrentStep('dialog-shelf');
    });
    expect(result.current.currentStep).toBe('dialog-shelf');

    act(() => {
      result.current.setCurrentStep(null);
    });
    expect(result.current.currentStep).toBe(null);
  });
});
