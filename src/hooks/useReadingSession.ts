import { useRef, useCallback, useEffect } from 'react';
import { ReadingSession } from './useReadingStats';

interface UseReadingSessionOptions {
  bookId: string;
  addSession: (session: ReadingSession) => void;
  currentProgress: number;
  currentLocation: string;
}

export function useReadingSession({
  bookId,
  addSession,
  currentProgress,
  currentLocation,
}: UseReadingSessionOptions) {
  const sessionStartRef = useRef<Date | null>(null);
  const lastInteractionRef = useRef<Date>(new Date());
  const isActiveRef = useRef<boolean>(true);
  const accumulatedTimeRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const startLocationRef = useRef<string>('');

  // Keep refs in sync with latest values so closures always read current state
  const currentProgressRef = useRef(currentProgress);
  const currentLocationRef = useRef(currentLocation);

  useEffect(() => { currentProgressRef.current = currentProgress; }, [currentProgress]);
  useEffect(() => { currentLocationRef.current = currentLocation; }, [currentLocation]);

  const commitSession = useCallback(() => {
    if (!sessionStartRef.current) return;

    let finalDuration = accumulatedTimeRef.current;
    if (isActiveRef.current) {
      finalDuration += new Date().getTime() - sessionStartRef.current.getTime();
    }

    // Skip sessions shorter than 10 seconds
    if (finalDuration < 10000) {
      sessionStartRef.current = new Date();
      accumulatedTimeRef.current = 0;
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
      return;
    }

    addSession({
      id: `session-${Date.now()}`,
      bookId,
      startTime: sessionStartRef.current.toISOString(),
      endTime: new Date().toISOString(),
      durationMs: finalDuration,
      startProgress: startProgressRef.current,
      endProgress: currentProgressRef.current,
      startLocation: startLocationRef.current,
      endLocation: currentLocationRef.current,
    });

    // Reset for next burst
    sessionStartRef.current = new Date();
    accumulatedTimeRef.current = 0;
    startProgressRef.current = currentProgressRef.current;
    startLocationRef.current = currentLocationRef.current;
  }, [addSession, bookId]);

  const handleInteraction = useCallback(() => {
    const now = new Date();
    const idleTime = now.getTime() - lastInteractionRef.current.getTime();

    if (idleTime > 5 * 60 * 1000 && isActiveRef.current) {
      commitSession();
    } else if (!isActiveRef.current) {
      sessionStartRef.current = new Date();
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
      isActiveRef.current = true;
    }

    lastInteractionRef.current = now;
  }, [commitSession]);

  // Sync start refs once we have an actual position (first relocate)
  useEffect(() => {
    if (startProgressRef.current === 0 && currentProgress > 0) {
      startProgressRef.current = currentProgress;
    }
    if (startLocationRef.current === '' && currentLocation !== '') {
      startLocationRef.current = currentLocation;
    }
  }, [currentProgress, currentLocation]);

  // Visibility + interaction + idle tracking
  useEffect(() => {
    if (!sessionStartRef.current) {
      sessionStartRef.current = new Date();
      lastInteractionRef.current = new Date();
      isActiveRef.current = true;
      accumulatedTimeRef.current = 0;
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isActiveRef.current = false;
        commitSession();
      } else {
        sessionStartRef.current = new Date();
        lastInteractionRef.current = new Date();
        isActiveRef.current = true;
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    const idleInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      const idleTime = new Date().getTime() - lastInteractionRef.current.getTime();
      if (idleTime > 5 * 60 * 1000) {
        isActiveRef.current = false;
        commitSession();
      }
    }, 30000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      clearInterval(idleInterval);
    };
  }, [handleInteraction, commitSession]);

  return { commitSession };
}
