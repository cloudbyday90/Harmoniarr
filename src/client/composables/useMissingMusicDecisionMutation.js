/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { onBeforeUnmount, ref, toValue, watch } from 'vue';
import { createMissingMusicReleaseMutationGate } from '../lib/missing-music-release-mutation-gate.js';
import { createRetryIdempotencyKeyStore } from '../lib/retry-idempotency-key-store.js';

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function publicErrorMessage(error, fallback) {
  if (error?.code === 'reauth_required' || error?.status === 401) {
    return 'Sign in again before changing this release.';
  }
  if (error?.status === 404) return 'This release is unavailable or you do not have access to it.';
  if (error?.status === 403) return 'You cannot change this release. Refresh its status before trying again.';
  if (error?.status === 409) return 'This release changed or work is already active. Refresh its status before trying again.';
  if (error?.status === 429) return 'Too many actions were requested. Wait a moment and try again.';
  return fallback;
}

/**
 * Owns one command's feedback and uncertain-retry key. Inspector commands share
 * a gate, while route/disposal guards keep late responses in their own scope.
 * This client gate supplements server authorization and durable idempotency.
 */
export function useMissingMusicDecisionMutation({
  actionKey,
  decisionId = null,
  executeMutation,
  fallbackErrorMessage,
  mutationGate = createMissingMusicReleaseMutationGate(),
  pendingMessage,
  retryIntentState = {},
  retryIdempotencyKeyStore = createRetryIdempotencyKeyStore(),
  scope,
  successMessage,
} = {}) {
  const activePayload = ref(null);
  const errorMessage = ref('');
  const isPending = ref(false);
  const statusMessage = ref('');
  let disposed = false;
  let generation = 0;

  function clearFeedback() {
    errorMessage.value = '';
    statusMessage.value = '';
  }

  function clearPreviousIntent() {
    if (retryIntentState.actionKey) retryIntentState.store.clear(retryIntentState.actionKey);
    retryIntentState.actionKey = null;
    retryIntentState.store = null;
  }

  watch(() => normalizeId(toValue(decisionId)), () => {
    generation += 1;
    clearPreviousIntent();
    clearFeedback();
  }, { flush: 'sync' });

  async function run(payload = {}) {
    const normalizedDecisionId = normalizeId(payload.decisionId);
    const selectedDecisionId = normalizeId(toValue(decisionId));
    if (disposed || !normalizedDecisionId || isPending.value
      || (selectedDecisionId && selectedDecisionId !== normalizedDecisionId)
      || !mutationGate.acquire(normalizedDecisionId)) return null;

    const currentGeneration = generation;
    const isCurrent = () => !disposed && generation === currentGeneration
      && (!decisionId || normalizeId(toValue(decisionId)) === normalizedDecisionId);
    let key;
    activePayload.value = payload;
    isPending.value = true;
    clearFeedback();
    statusMessage.value = pendingMessage;

    try {
      key = actionKey({ ...payload, decisionId: normalizedDecisionId });
      if (retryIntentState.actionKey !== key) clearPreviousIntent();
      retryIntentState.actionKey = key;
      retryIntentState.store = retryIdempotencyKeyStore;
      const idempotencyKey = retryIdempotencyKeyStore.getOrCreate({ actionKey: key, scope });
      const result = await executeMutation({ ...payload, decisionId: normalizedDecisionId, idempotencyKey });
      retryIdempotencyKeyStore.clear(key);
      if (!isCurrent()) return null;
      statusMessage.value = typeof successMessage === 'function' ? successMessage(result) : successMessage;
      return result;
    } catch (error) {
      if (key && Number.isInteger(error?.status) && error.status >= 400 && error.status < 500
        && error.code !== 'idempotency_key_in_progress') retryIdempotencyKeyStore.clear(key);
      if (isCurrent()) {
        errorMessage.value = publicErrorMessage(error, fallbackErrorMessage);
        statusMessage.value = '';
      }
      return null;
    } finally {
      mutationGate.release(normalizedDecisionId);
      if (!disposed) {
        activePayload.value = null;
        isPending.value = false;
      }
    }
  }

  onBeforeUnmount(() => {
    disposed = true;
    generation += 1;
  });

  return { activePayload, clearFeedback, errorMessage, isPending, run, statusMessage };
}
