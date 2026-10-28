/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { fetchProviderStatus } from '../lib/provider-api.js';
import { normalizeAppleMusicSigningStatus } from '../lib/apple-music-signing-presentation.js';

export function useAppleMusicSigningStatus({ fetchStatus = fetchProviderStatus, timeoutMs = 15_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError('Invalid status timeout');
  const status = ref(null), isLoading = ref(false), failed = ref(false);
  let active = null, disposed = false;
  function invalidate() {
    const request = active; active = null;
    if (request) { clearTimeout(request.timer); request.controller.abort(); }
    status.value = null; isLoading.value = false; failed.value = false;
  }
  function dispose() { disposed = true; invalidate(); }
  if (getCurrentScope()) onScopeDispose(dispose);
  async function load() {
    if (disposed || isLoading.value) return null;
    invalidate(); isLoading.value = true;
    const request = { controller: new AbortController(), timer: null }; active = request;
    request.timer = setTimeout(() => {
      if (active !== request) return;
      active = null; failed.value = true; isLoading.value = false; request.controller.abort();
    }, timeoutMs);
    try {
      const payload = await fetchStatus({ signal: request.controller.signal });
      if (active !== request) return null;
      const next = normalizeAppleMusicSigningStatus(payload?.appleMusic?.localSigning);
      if (!next) { failed.value = true; return null; }
      status.value = next; return next;
    } catch {
      if (active === request) failed.value = true;
      return null;
    } finally {
      clearTimeout(request.timer);
      if (active === request) { active = null; isLoading.value = false; }
    }
  }
  return { status: readonly(status), isLoading: readonly(isLoading), failed: readonly(failed), load, invalidate, dispose };
}
