import { useEffect, useState } from 'react';
import { storageService } from '@/services/storage';

const LAST_VISIT_KEY = 'offreader-last-visit';
const LAST_VERSION_KEY = 'offreader-last-seen-version';

export type WelcomeDialogMode = 'first-time' | 'welcome-back' | null;

interface UseWelcomeDialogResult {
  mode: WelcomeDialogMode;
  lastVersion: string | null;
  dismiss: () => Promise<void>;
}

export function useWelcomeDialog(): UseWelcomeDialogResult {
  const [mode, setMode] = useState<WelcomeDialogMode>(null);
  const [lastVersion, setLastVersion] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const lastVisit = await storageService.getItem(LAST_VISIT_KEY);

      if (!lastVisit) {
        setMode('first-time');
        return;
      }

      const storedVersion = await storageService.getItem(LAST_VERSION_KEY);
      setLastVersion(storedVersion);
      if (storedVersion !== __APP_VERSION__) {
        setMode('welcome-back');
      }
    }

    check();
  }, []);

  const dismiss = async (): Promise<void> => {
    setMode(null);
    await storageService.setItem(LAST_VISIT_KEY, new Date().toISOString());
    await storageService.setItem(LAST_VERSION_KEY, __APP_VERSION__);
  };

  return { mode, lastVersion, dismiss };
}
