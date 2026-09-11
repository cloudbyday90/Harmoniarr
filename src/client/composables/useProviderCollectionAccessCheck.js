/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getCurrentScope, onScopeDispose, readonly, ref, watch } from 'vue';
import { checkProviderCollectionAccess } from '../lib/provider-api.js';
import {
  buildProviderCollectionAccessError,
  buildProviderCollectionAccessSummary,
} from '../lib/provider-collection-access-presentation.js';

export function useProviderCollectionAccessCheck({
  checkAccess = checkProviderCollectionAccess,
} = {}) {
  const sourceUrl = ref('');
  const isChecking = ref(false);
  const errorMessage = ref('');
  const isInputInvalid = ref(false);
  const result = ref(null);
  let activeController = null;

  function clearCheck() {
    activeController?.abort();
    activeController = null;
    isChecking.value = false;
    errorMessage.value = '';
    isInputInvalid.value = false;
    result.value = null;
  }

  watch(sourceUrl, clearCheck, { flush: 'sync' });
  if (getCurrentScope()) onScopeDispose(clearCheck);

  async function runCheck() {
    if (isChecking.value) return null;
    const submittedUrl = sourceUrl.value.trim();
    if (!submittedUrl || submittedUrl.length > 2048) {
      isInputInvalid.value = true;
      errorMessage.value = 'Enter a playlist or artist URL of 2,048 characters or fewer.';
      return null;
    }

    errorMessage.value = '';
    isInputInvalid.value = false;
    result.value = null;
    isChecking.value = true;
    const controller = new AbortController();
    activeController = controller;

    try {
      const payload = await checkAccess({ sourceUrl: submittedUrl }, { signal: controller.signal });
      if (activeController !== controller) return null;
      const summary = buildProviderCollectionAccessSummary(payload?.check);
      if (payload?.ok !== true || !summary) {
        errorMessage.value = buildProviderCollectionAccessError();
        return null;
      }
      result.value = summary;
      return summary;
    } catch (error) {
      if (activeController === controller) {
        isInputInvalid.value = error?.status === 400;
        errorMessage.value = buildProviderCollectionAccessError(error);
      }
      return null;
    } finally {
      if (activeController === controller) {
        activeController = null;
        isChecking.value = false;
      }
    }
  }

  return {
    errorMessage: readonly(errorMessage),
    isChecking: readonly(isChecking),
    isInputInvalid: readonly(isInputInvalid),
    result: readonly(result),
    runCheck,
    sourceUrl,
  };
}
