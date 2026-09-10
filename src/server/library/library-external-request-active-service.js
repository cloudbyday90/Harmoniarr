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

import { createApiError } from '../auth.js';
import { createOperationRunCancellationError } from '../operation-run-cancellation.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';

export function createLibraryExternalRequestActiveService({
  mediaRequestStore = createLibraryMediaRequestStore(),
} = {}) {
  async function getActiveExternalRequest({ mediaRequestId, operationRunId = null }) {
    const request = await mediaRequestStore.getMediaRequestById({ mediaRequestId });
    if (!request) {
      throw createApiError(404, 'media_request_not_found', 'Media request was not found');
    }
    if (request.requestKind !== 'external_url' || !request.sourceUrl) {
      throw createApiError(409, 'media_request_not_external_url', 'Media request does not contain an external provider URL');
    }
    if (request.requestState !== 'needs_fetch') {
      throw createOperationRunCancellationError({
        message: 'External provider work stopped because the music request is no longer active',
        runId: operationRunId,
      });
    }
    return request;
  }

  return { getActiveExternalRequest };
}
