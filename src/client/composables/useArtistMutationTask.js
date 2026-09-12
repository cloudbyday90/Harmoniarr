/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';

/** Invalidate UI ownership, never cancel or retry an already submitted mutation. */
export function useArtistMutationTask({ getScope, fallbackMessage }) {
  const isPending = ref(false);
  const error = ref('');
  let generation = 0;
  let disposed = false;
  function invalidate() {
    generation += 1;
    isPending.value = false;
    error.value = '';
  }
  const scopeKey = () => JSON.stringify(getScope());
  const stop = watch(scopeKey, invalidate, { flush: 'sync' });
  function dispose() {
    disposed = true;
    invalidate();
    stop();
  }
  if (getCurrentScope()) onScopeDispose(dispose);

  async function run(submit, onSuccess = () => {}) {
    if (disposed || isPending.value) return { skipped: true };
    const scope = { ...getScope() };
    const key = JSON.stringify(scope);
    const ownGeneration = ++generation;
    const isCurrent = () => !disposed && ownGeneration === generation && key === scopeKey();
    isPending.value = true;
    error.value = '';
    try {
      const result = await submit(scope);
      if (!isCurrent()) return { stale: true };
      await onSuccess(result, scope, isCurrent);
      return isCurrent() ? { ok: true } : { stale: true };
    } catch (cause) {
      if (!isCurrent()) return { stale: true };
      error.value = getErrorMessage(cause, fallbackMessage);
      return { ok: false, error: cause };
    } finally {
      if (isCurrent()) isPending.value = false;
    }
  }
  return { isPending, error, run, invalidate, dispose };
}
