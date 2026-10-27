/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';
import { fetchSchemaDiagnostics } from '../lib/schema-diagnostics-api.js';
import { projectSchemaDiagnosticsPayload, schemaDiagnosticsMessages } from '../lib/schema-diagnostics-presentation.js';

export function useSchemaDiagnostics({ fetchFn = fetchSchemaDiagnostics } = {}) {
  const state = ref('idle'), report = ref(null);
  const message = computed(() => schemaDiagnosticsMessages[state.value]);
  let disposed = false, controller = null;
  async function refresh() {
    if (disposed || state.value === 'loading') return;
    state.value = 'loading'; report.value = null;
    controller = new AbortController();
    try {
      const result = projectSchemaDiagnosticsPayload(await fetchFn({ signal: controller.signal }));
      if (disposed) return;
      state.value = result.state;
      report.value = ['current', 'attention'].includes(result.state) ? result : null;
    } catch (error) {
      if (disposed) return;
      state.value = [401, 403].includes(error?.status) ? 'forbidden' : error?.status === 429 ? 'limited' : 'unavailable';
    } finally { controller = null; }
  }
  function dispose() { disposed = true; controller?.abort(); report.value = null; }
  if (getCurrentScope()) onScopeDispose(dispose);
  return { state, report, message, refresh };
}
