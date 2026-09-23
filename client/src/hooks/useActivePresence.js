import { useCallback, useEffect, useRef, useState } from 'react';
import { sendHeartbeat } from '../services/presenceService.js';

const ACTIVITY_EVENTS = ['mousemove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'];

// Proof of active presence for a live session inside the portal.
//
// Heartbeats are sent only while ALL of these hold:
//   - inCall:       the participant has actually joined the video call
//   - isTabActive:  the page is visible and the window has focus (focus inside
//                   the embedded call counts as focus on this page)
//   - !isIdle:      there was page activity within the idle timeout. Activity
//                   inside the call iframe can't be seen by this page, so after
//                   the timeout we ask "Are you still there?" (confirmPresent).
//
// The server measures time between heartbeats itself; this hook never tells it
// how much time to add. `initialStatus` / heartbeat responses come from
// GET /api/sessions/:id/presence and POST /api/sessions/:id/heartbeat.
export function useActivePresence({ sessionId, inCall, live, initialStatus, onEligibilityChange }) {
  const [status, setStatus] = useState(initialStatus);
  const [isTabActive, setTabActive] = useState(() => document.visibilityState === 'visible' && document.hasFocus());
  const [isIdle, setIdle] = useState(false);
  const [error, setError] = useState(null);
  const lastActivity = useRef(Date.now());
  const eligibleRef = useRef(Boolean(initialStatus?.isEligible));
  const onEligibilityRef = useRef(onEligibilityChange);
  onEligibilityRef.current = onEligibilityChange;

  const config = status?.config || initialStatus?.config;
  const intervalMs = (config?.heartbeatIntervalSeconds ?? 60) * 1000;
  const idleMs = (config?.idleTimeoutSeconds ?? 120) * 1000;

  // ---- 1. Tab / window visibility --------------------------------------------
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== 'visible') return setTabActive(false);
      // Clicking into the embedded call moves focus to its iframe, which blurs
      // this window. That still counts as watching.
      const focusInCall = document.activeElement?.tagName === 'IFRAME';
      setTabActive(document.hasFocus() || focusInCall);
    };
    // blur fires before activeElement updates, so check on the next tick.
    const onBlur = () => setTimeout(update, 0);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', onBlur);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // ---- 2. Idle (no mouse / keyboard / touch / scroll) ---------------------------
  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setIdle(false);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
      setIdle((idle) => (idle ? false : idle));
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current >= idleMs) setIdle(true);
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [idleMs]);

  // ---- 3. Heartbeat while tracking ------------------------------------------------
  const isTracking = Boolean(inCall && live && isTabActive && !isIdle);

  useEffect(() => {
    if (!isTracking) return undefined;
    let cancelled = false;
    const ping = async () => {
      try {
        const next = await sendHeartbeat(sessionId);
        if (cancelled) return;
        setError(null);
        setStatus(next);
        if (next.isEligible !== eligibleRef.current) {
          eligibleRef.current = next.isEligible;
          onEligibilityRef.current?.(next.isEligible, next);
        }
      } catch (err) {
        // 429 = resumed too soon after the previous ping: harmless, keep going.
        if (!cancelled && err.status !== 429) setError(err);
      }
    };
    // First ping anchors the server clock (it earns nothing by itself).
    ping();
    const timer = setInterval(ping, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isTracking, sessionId, intervalMs]);

  return {
    status,
    activeMinutes: status?.activeMinutes ?? 0,
    requiredMinutes: status?.requiredMinutes ?? 0,
    progressPercent: status?.progressPercent ?? 0,
    isEligible: Boolean(status?.isEligible),
    attendanceRecorded: status?.attendanceStatus === 'PRESENT',
    isTabActive,
    isIdle,
    isTracking,
    error,
    config,
    markActivity,
    confirmPresent: markActivity,
  };
}
