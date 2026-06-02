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

import { readonly, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { retryDownloadRecoveryDiscoveryRequest as defaultRetryDownloadRecoveryDiscoveryRequest } from '../lib/library-api.js';
import { useToast } from './useToast.js';

function resolveMetadataReleaseId(releaseOrId) {
  if (typeof releaseOrId === 'string') {
    return releaseOrId;
  }

  return releaseOrId?.metadataReleaseId ?? null;
}

export function useDownloadRecoveryRetry({
  retryDownloadRecoveryDiscoveryRequest = defaultRetryDownloadRecoveryDiscoveryRequest,
  toast = useToast(),
} = {}) {
  const errorMessage = ref('');
  const retryingReleaseIds = ref(new Set());

  function setRetrying(metadataReleaseId, retrying) {
    const next = new Set(retryingReleaseIds.value);
    if (retrying) {
      next.add(metadataReleaseId);
    } else {
      next.delete(metadataReleaseId);
    }
    retryingReleaseIds.value = next;
  }

  function isRetrying(releaseOrId) {
    const metadataReleaseId = resolveMetadataReleaseId(releaseOrId);
    return metadataReleaseId ? retryingReleaseIds.value.has(metadataReleaseId) : false;
  }

  async function retryDownloadRecovery(releaseOrId) {
    const metadataReleaseId = resolveMetadataReleaseId(releaseOrId);
    if (!metadataReleaseId) {
      const message = 'Cannot retry recovery without a metadata release id.';
      errorMessage.value = message;
      toast.error(message);
      return { ok: false, skipped: true };
    }

    if (isRetrying(metadataReleaseId)) {
      return { ok: false, skipped: true };
    }

    errorMessage.value = '';
    setRetrying(metadataReleaseId, true);

    try {
      const result = await retryDownloadRecoveryDiscoveryRequest({ metadataReleaseId });
      if (result.dispatchAlreadyActive) {
        toast.info('Recovery retry reset. Discovery dispatch is already running.');
      } else {
        toast.success('Recovery retry queued.');
      }
      return { ok: true, result };
    } catch (error) {
      const message = getErrorMessage(error, 'Recovery retry failed');
      errorMessage.value = message;
      toast.error(message);
      return { error, ok: false };
    } finally {
      setRetrying(metadataReleaseId, false);
    }
  }

  return {
    errorMessage,
    isRetrying,
    retryDownloadRecovery,
    retryingReleaseIds: readonly(retryingReleaseIds),
  };
}
