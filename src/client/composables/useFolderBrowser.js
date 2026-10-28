/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { browseFsDirectory } from '../lib/system-api.js';

function isDirectoryResult(result) {
  const isPath = value => typeof value === 'string' && value.length > 0;
  return result?.ok === true && isPath(result.path)
    && (result.parent == null || isPath(result.parent))
    && Array.isArray(result.entries)
    && result.entries.every(entry => isPath(entry?.name) && isPath(entry?.path))
    && new Set(result.entries.map(entry => entry.path)).size === result.entries.length;
}

/** Owns one dialog's reads. Cancellation saves work; identity fences publication. */
export function useFolderBrowser({ browse = browseFsDirectory } = {}) {
  const requestedPath = ref('');
  const currentPath = ref(null);
  const parentPath = ref(null);
  const entries = ref([]);
  const isLoading = ref(false);
  const errorMessage = ref('');
  let activeRequest = null;
  let disposed = false;
  const canSelect = computed(() => !disposed && currentPath.value !== null
    && !isLoading.value && !errorMessage.value);

  async function navigate(path) {
    if (disposed || typeof path !== 'string' || !path) return;
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    requestedPath.value = path;
    currentPath.value = null;
    parentPath.value = null;
    entries.value = [];
    errorMessage.value = '';
    isLoading.value = true;
    const ownsRead = () => !disposed && activeRequest === request;
    try {
      const result = await browse({ path, signal: request.signal });
      if (!ownsRead()) return;
      if (!isDirectoryResult(result)) throw new Error('Invalid directory response');
      currentPath.value = result.path;
      parentPath.value = result.parent ?? null;
      entries.value = result.entries.map(({ name, path: entryPath }) => ({ name, path: entryPath }));
    } catch {
      if (ownsRead()) errorMessage.value = 'Could not read this folder. Try again.';
    } finally {
      if (ownsRead()) {
        isLoading.value = false;
        activeRequest = null;
      }
    }
  }

  function dispose() {
    disposed = true;
    activeRequest?.abort();
    activeRequest = null;
    currentPath.value = null;
    parentPath.value = null;
    entries.value = [];
    isLoading.value = false;
  }
  if (getCurrentScope()) onScopeDispose(dispose);
  return { requestedPath: readonly(requestedPath), currentPath: readonly(currentPath),
    parentPath: readonly(parentPath), entries: readonly(entries), isLoading: readonly(isLoading),
    errorMessage: readonly(errorMessage), canSelect, navigate, dispose };
}
