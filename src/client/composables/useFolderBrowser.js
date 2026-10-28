/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { browseFsDirectory } from '../lib/system-api.js';
import { FOLDER_PATH_LIMIT, isFolderPage } from '../../shared/folder-browse-policy.js';

function isDirectoryResult(result) {
  const isPath = value => typeof value === 'string' && value.length > 0 && value.length <= FOLDER_PATH_LIMIT + 513;
  return result?.ok === true && isPath(result.path)
    && (result.parent == null || isPath(result.parent))
    && isFolderPage(result.page, result.entries)
    && result.entries.every(entry => isPath(entry?.name) && entry.name.length <= 512 && isPath(entry?.path))
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
  const page = ref(null);
  let requestedCursor;
  let activeRequest = null;
  let disposed = false;
  const canSelect = computed(() => !disposed && currentPath.value !== null
    && !isLoading.value && !errorMessage.value);

  async function navigate(path, cursor) {
    if (disposed || typeof path !== 'string' || !path) return;
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    requestedPath.value = path;
    requestedCursor = cursor;
    currentPath.value = null;
    parentPath.value = null;
    entries.value = [];
    page.value = null;
    errorMessage.value = '';
    isLoading.value = true;
    const ownsRead = () => !disposed && activeRequest === request;
    try {
      const result = await browse({ path, cursor, signal: request.signal });
      if (!ownsRead()) return;
      if (!isDirectoryResult(result)) throw new Error('Invalid directory response');
      currentPath.value = result.path;
      parentPath.value = result.parent ?? null;
      entries.value = result.entries.map(({ name, path: entryPath }) => ({ name, path: entryPath }));
      page.value = { ...result.page };
    } catch (error) {
      if (ownsRead()) {
        const messages = {
          folder_page_changed: 'Folder contents changed or this page expired. Start again to reload the folder.',
          folder_scan_limit: 'This folder is too large to browse. Enter a more specific path.',
          folder_browse_timeout: 'This folder took too long to read. Enter a more specific path.',
          folder_browse_busy: 'Folder browsing is busy. Try again shortly.',
        };
        errorMessage.value = Object.hasOwn(messages, error?.code) ? messages[error.code] : 'Could not read this folder. Try again.';
      }
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
    page.value = null;
    requestedCursor = undefined;
    isLoading.value = false;
  }
  if (getCurrentScope()) onScopeDispose(dispose);
  return { requestedPath: readonly(requestedPath), currentPath: readonly(currentPath),
    parentPath: readonly(parentPath), entries: readonly(entries), isLoading: readonly(isLoading),
    errorMessage: readonly(errorMessage), page: readonly(page), canSelect, navigate, dispose,
    retry: () => navigate(requestedPath.value, requestedCursor) };
}
