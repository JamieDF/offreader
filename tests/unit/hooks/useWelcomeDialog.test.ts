/**
 * Tests for the welcome dialog hook — determines whether to show
 * first-time setup or welcome-back message based on stored visit state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWelcomeDialog } from '@/hooks/useWelcomeDialog';
import { storageService } from '@/services/storage';

const APP_VERSION = '0.7.0';

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: vi.fn(),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

// Make __APP_VERSION__ available to the hook
Object.defineProperty(globalThis, '__APP_VERSION__', {
  value: APP_VERSION,
  writable: true,
});

const mockGetItem = storageService.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = storageService.setItem as ReturnType<typeof vi.fn>;

describe('useWelcomeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses first-time mode when tour-completed is also missing (tour handles it)', async () => {
    // Fresh install with no lastVisit AND no tour-completed: the
    // onboarding tour handles first-run onboarding, so the welcome
    // dialog stays closed.
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      if (key === 'offreader-last-seen-version') return Promise.resolve(null);
      if (key === 'offreader-tour-completed') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useWelcomeDialog());

    await waitFor(() => {
      expect(result.current.mode).toBe(null);
    });
  });

  it('shows first-time mode when tour-completed is set but last-visit is missing', async () => {
    // User finished the tour and then somehow lost their lastVisit (e.g.
    // cleared storage but the tour marker survived). Show first-time.
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      if (key === 'offreader-last-seen-version') return Promise.resolve(null);
      if (key === 'offreader-tour-completed') return Promise.resolve('2026-01-01T00:00:00Z');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useWelcomeDialog());

    await waitFor(() => {
      expect(result.current.mode).toBe('first-time');
    });
  });

  it('shows welcome-back mode when last-visit exists but version changed', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-last-visit') return Promise.resolve('2024-01-01T00:00:00Z');
      if (key === 'offreader-last-seen-version') return Promise.resolve('0.5.0');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useWelcomeDialog());

    await waitFor(() => {
      expect(result.current.mode).toBe('welcome-back');
    });
    await waitFor(() => {
      expect(result.current.lastVersion).toBe('0.5.0');
    });
  });

  it('shows null (no dialog) when last-visit exists and version matches', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-last-visit') return Promise.resolve('2024-01-01T00:00:00Z');
      if (key === 'offreader-last-seen-version') return Promise.resolve(APP_VERSION);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useWelcomeDialog());

    await waitFor(() => {
      expect(result.current.mode).toBe(null);
    });
  });

  it('dismiss saves current version and visit date', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'offreader-last-visit') return Promise.resolve(null);
      if (key === 'offreader-last-seen-version') return Promise.resolve(null);
      if (key === 'offreader-tour-completed') return Promise.resolve('2026-01-01T00:00:00Z');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useWelcomeDialog());
    await waitFor(() => expect(result.current.mode).toBe('first-time'));

    await result.current.dismiss();

    await waitFor(() => {
      expect(result.current.mode).toBe(null);
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      'offreader-last-seen-version',
      APP_VERSION
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      'offreader-last-visit',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });
});
