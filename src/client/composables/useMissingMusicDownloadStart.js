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

import { ref } from 'vue';
import { startMissingMusicDecisionDownload as defaultStartMissingMusicDecisionDownload } from '../lib/missing-music-api.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createRetryIdempotencyKeyStore } from '../lib/retry-idempotency-key-store.js';

function normalizeDecisionId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function useMissingMusicDownloadStart({
  retryIdempotencyKeyStore = createRetryIdempotencyKeyStore(),
  startMissingMusicDecisionDownload = defaultStartMissingMusicDecisionDownload,
} = {}) {
  const errorMessage = ref('');
  const isStarting = ref(false);
  const statusMessage = ref('');

  async function startDownload({ decisionId } = {}) {
    const normalizedDecisionId = normalizeDecisionId(decisionId);
    if (!normalizedDecisionId || isStarting.value) {
      return null;
    }

    const actionKey = `${normalizedDecisionId}:start-download`;
    const idempotencyKey = retryIdempotencyKeyStore.getOrCreate({
      actionKey,
      scope: 'missing-music.decisions.download.start',
    });
    errorMessage.value = '';
    isStarting.value = true;
    statusMessage.value = 'Starting download preparation…';

    try {
      const payload = await startMissingMusicDecisionDownload({
        decisionId: normalizedDecisionId,
        idempotencyKey,
      });
      retryIdempotencyKeyStore.clear(actionKey);
      statusMessage.value = 'Download preparation started. Transfer progress will appear in Downloader after it is submitted.';
      return payload;
    } catch (error) {
      if (Number.isInteger(error?.status)) {
        retryIdempotencyKeyStore.clear(actionKey);
      }
      errorMessage.value = getErrorMessage(error, 'The download could not be started.');
      statusMessage.value = '';
      return null;
    } finally {
      isStarting.value = false;
    }
  }

  function clearFeedback() {
    errorMessage.value = '';
    statusMessage.value = '';
  }

  return {
    clearFeedback,
    errorMessage,
    isStarting,
    startDownload,
    statusMessage,
  };
}
