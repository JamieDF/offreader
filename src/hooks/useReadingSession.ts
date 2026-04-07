import { useRef, useCallback, useEffect } from 'react';
import { ReadingSession } from './useReadingStats';

interface UseReadingSessionOptions {
  bookId: string;
  addSession: (session: ReadingSession) => void;
  currentProgress: number;
  currentLocation: string;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;
const MIN_SESSION_DURATION_MS = 10 * 1000;

export function useReadingSession({
  bookId,
  addSession,
  currentProgress,
  currentLocation,
}: UseReadingSessionOptions) {
  const sessionStartRef = useRef<Date | null>(null);
  const lastInteractionRef = useRef<Date>(new Date());
  const isPausedRef = useRef<boolean>(true);
  const accumulatedTimeRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const startLocationRef = useRef<string>('');

  const currentProgressRef = useRef(currentProgress);
  const currentLocationRef = useRef(currentLocation);

  useEffect(() => { currentProgressRef.current = currentProgress; }, [currentProgress]);
  useEffect(() => { currentLocationRef.current = currentLocation; }, [currentLocation]);

  const startSession = useCallback(() => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      sessionStartRef.current = new Date();
      lastInteractionRef.current = new Date();
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
    }
  }, []);

  const pauseSession = useCallback(() => {
    if (!isPausedRef.current && sessionStartRef.current) {
      const elapsed = new Date().getTime() - sessionStartRef.current.getTime();
      accumulatedTimeRef.current += elapsed;
      isPausedRef.current = true;
    }
  }, []);

  const commitSession = useCallback(() => {
    pauseSession();

    const totalDuration = accumulatedTimeRef.current;

    if (totalDuration < MIN_SESSION_DURATION_MS) {
      accumulatedTimeRef.current = 0;
      sessionStartRef.current = new Date();
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
      return;
    }

    addSession({
      id: `session-${Date.now()}`,
      bookId,
      startTime: sessionStartRef.current!.toISOString(),
      endTime: new Date().toISOString(),
      durationMs: totalDuration,
      startProgress: startProgressRef.current,
      endProgress: currentProgressRef.current,
      startLocation: startLocationRef.current,
      endLocation: currentLocationRef.current,
    });

    accumulatedTimeRef.current = 0;
    sessionStartRef.current = new Date();
    startProgressRef.current = currentProgressRef.current;
    startLocationRef.current = currentLocationRef.current;
  }, [pauseSession, addSession, bookId]);

  const handleInteraction = useCallback(() => {
    const now = new Date();
    const idleTime = now.getTime() - lastInteractionRef.current.getTime();

    if (isPausedRef.current && idleTime < IDLE_TIMEOUT_MS) {
      startSession();
    }

    lastInteractionRef.current = now;
  }, [startSession]);

  useEffect(() => {
    if (!sessionStartRef.current) {
      startSession();
    }
  }, [startSession]);

  useEffect(() => {
    if (startProgressRef.current === 0 && currentProgress > 0) {
      startProgressRef.current = currentProgress;
    }
    if (startLocationRef.current === '' && currentLocation !== '') {
      startLocationRef.current = currentLocation;
    }
  }, [currentProgress, currentLocation]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pauseSession();
      } else {
        startSession();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    const idleInterval = setInterval(() => {
      const idleTime = new Date().getTime() - lastInteractionRef.current.getTime();
      if (idleTime > IDLE_TIMEOUT_MS && !isPausedRef.current) {
        pauseSession();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      clearInterval(idleInterval);
    };
  }, [handleInteraction, pauseSession, startSession]);

  return { commitSession };
}
