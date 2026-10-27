/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { fetchSchemaDiagnostics } from '../lib/schema-diagnostics-api.js';
import { projectSchemaDiagnosticsPayload, schemaDiagnosticsMessages } from '../lib/schema-diagnostics-presentation.js';

export function useSchemaDiagnostics({ fetchFn = fetchSchemaDiagnostics, timeoutMs = 25_000 } = {}) {
  const state = ref('idle'), report = ref(null);
  const message = computed(() => schemaDiagnosticsMessages[state.value]);
  let disposed = false, controller = null;
  async function refresh() {
    if (disposed || controller) return;
    state.value = 'loading'; report.value = null;
    controller = new AbortController();
    const current = controller;
    const timer = setTimeout(() => current.abort(), timeoutMs);
    let rejectAbort;
    const cancelled = new Promise((_resolve, reject) => { rejectAbort = () => reject(new Error('Schema diagnostics request cancelled')); });
    current.signal.addEventListener('abort', rejectAbort, { once: true });
    try {
      // Only follow an already-running startup check within the existing request
      // deadline. Reading status never starts a schema scan or permanent UI poll.
      while (!disposed) {
        const result = projectSchemaDiagnosticsPayload(await Promise.race([fetchFn({ signal: current.signal }), cancelled]));
        if (disposed) return;
        state.value = result.state;
        report.value = ['current', 'attention', 'pending', 'running', 'paused', 'stale'].includes(result.state) ? result : null;
        if (!['pending', 'running'].includes(result.state)) return;
        let delay;
        try { await Promise.race([new Promise(resolve => { delay = setTimeout(resolve, 5_000); }), cancelled]); }
        finally { clearTimeout(delay); }
      }
    } catch (error) {
      if (disposed) return;
      report.value = null;
      state.value = [401, 403].includes(error?.status) ? 'forbidden' : error?.status === 429 ? 'limited' : 'unavailable';
    } finally { clearTimeout(timer); current.signal.removeEventListener('abort', rejectAbort); controller = null; }
  }
  function dispose() { disposed = true; controller?.abort(); report.value = null; }
  if (getCurrentScope()) onScopeDispose(dispose);
  return { state, report, message, refresh };
}
