/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { computed, nextTick, ref } from 'vue';

/** One form owns pending feedback through its request and navigation. No retries. */
export function useAuthSubmission() {
  const activeAction = ref(null); const errorMessage = ref(''); const pendingMessage = ref('');
  const isSubmitting = computed(() => activeAction.value !== null);
  async function run(action, { name = 'submit', pendingText = 'Submitting…', fallbackMessage = 'Submission failed' } = {}) {
    if (isSubmitting.value) return false;
    activeAction.value = name; errorMessage.value = ''; pendingMessage.value = pendingText;
    try {
      // Flush cleared errors before an immediate repeated failure reuses its text.
      await nextTick();
      await action();
      return true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : fallbackMessage;
      return false;
    } finally {
      activeAction.value = null; pendingMessage.value = '';
    }
  }
  return { activeAction, errorMessage, isSubmitting, pendingMessage, run };
}
