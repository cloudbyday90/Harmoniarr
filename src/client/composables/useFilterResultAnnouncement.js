/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { nextTick, onScopeDispose, ref, toValue, watch } from 'vue';

/** One latest user action owns feedback; resource updates alone never announce. */
export function useFilterResultAnnouncement({ ready, failed, resultLabel, contextKey }) {
  const announcement = ref('');
  const pendingRequest = ref(0);
  let sequence = 0;
  let disposed = false;

  function cancel() {
    pendingRequest.value = 0;
    announcement.value = '';
  }

  function requestAnnouncement() {
    if (disposed) return;
    announcement.value = '';
    pendingRequest.value = ++sequence;
  }

  // Cancellation is immediate, including failure followed by a retry in one tick.
  watch(() => toValue(failed), (hasFailed) => {
    if (hasFailed && pendingRequest.value) cancel();
  }, { flush: 'sync' });
  watch(() => toValue(contextKey), cancel, { flush: 'sync' });

  watch([pendingRequest, () => toValue(ready)], async ([request, isReady], _, onCleanup) => {
    if (!request) return;
    if (toValue(failed)) { cancel(); return; }
    if (!isReady) return;
    let invalidated = false;
    onCleanup(() => { invalidated = true; });
    // Clear and republish after rendering, including repeated identical results.
    await nextTick();
    if (invalidated || disposed || pendingRequest.value !== request
      || !toValue(ready) || toValue(failed)) return;
    announcement.value = toValue(resultLabel);
    pendingRequest.value = 0;
  }, { flush: 'post' });

  onScopeDispose(() => { disposed = true; cancel(); });
  return { announcement, requestAnnouncement };
}
