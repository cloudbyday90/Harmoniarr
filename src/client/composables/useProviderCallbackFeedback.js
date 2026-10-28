/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { fetchProviderStatus } from '../lib/provider-api.js';
import { buildProviderCallbackFeedback, readSavedProviderLink } from '../lib/provider-callback-feedback-policy.js';

export function useProviderCallbackFeedback({ fetchStatus = fetchProviderStatus, timeoutMs = 15_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError('Invalid callback status timeout');
  const intent = ref(null), observation = ref('unknown'), isLoading = ref(false), permitted = ref(false), cleanupFailed = ref(false);
  let active = null, disposed = false;
  function invalidate() {
    const request = active; active = null;
    if (request) { clearTimeout(request.timer); request.controller.abort(); }
    observation.value = 'unknown'; isLoading.value = false;
  }
  function setPermission(value) {
    if (disposed) return;
    permitted.value = value === true;
    if (!permitted.value) invalidate();
  }
  async function check() {
    if (disposed || !permitted.value || !intent.value?.provider || isLoading.value) return;
    invalidate(); isLoading.value = true;
    const request = { provider: intent.value.provider, controller: new AbortController(), timer: null }; active = request;
    request.timer = setTimeout(() => {
      if (active !== request) return;
      active = null; observation.value = 'unknown'; isLoading.value = false; request.controller.abort();
    }, timeoutMs);
    try {
      const payload = await fetchStatus({ signal: request.controller.signal });
      if (active === request) observation.value = readSavedProviderLink(payload, request.provider);
    } catch { /* Public feedback remains fixed and does not inspect the thrown value. */ }
    finally {
      clearTimeout(request.timer);
      if (active === request) { active = null; isLoading.value = false; }
    }
  }
  function accept(nextIntent, allowed) {
    if (disposed) return;
    invalidate(); intent.value = nextIntent; cleanupFailed.value = false; setPermission(allowed);
    return check();
  }
  function markCleanupFailed() { if (!disposed) cleanupFailed.value = true; }
  function dispose() { disposed = true; invalidate(); intent.value = null; }
  if (getCurrentScope()) onScopeDispose(dispose);
  const feedback = computed(() => buildProviderCallbackFeedback({ intent: intent.value, observation: observation.value,
    isLoading: isLoading.value, permitted: permitted.value, cleanupFailed: cleanupFailed.value }));
  return { intent: readonly(intent), feedback, isLoading: readonly(isLoading), check, accept, setPermission, markCleanupFailed, dispose };
}
