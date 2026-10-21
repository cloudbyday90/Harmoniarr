/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readonly, ref } from 'vue';

// The caller refreshes after accepting a deadline or changing timer admission,
// and destroys this owner on unmount. A timer is a display aid, never authority.
export function useExpiryCountdown({ getExpiresAt, isActive }) {
  const secondsRemaining = ref(0);
  let timer = null;
  let destroyed = false;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function refresh() {
    if (destroyed) return;
    clearTimer();
    const value = getExpiresAt();
    const deadline = typeof value === 'string' ? Date.parse(value) : NaN;
    const remaining = Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0;
    secondsRemaining.value = Math.ceil(remaining / 1000);
    if (remaining > 0 && isActive()) {
      timer = setTimeout(refresh, Math.min(1000, remaining));
    }
  }

  function destroy() {
    destroyed = true;
    clearTimer();
  }

  return { secondsRemaining: readonly(secondsRemaining), refresh, destroy };
}
