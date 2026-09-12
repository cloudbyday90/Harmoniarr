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

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { createMediaRequest } from '../lib/library-api.js';
import { canRequestRelease, normalizeReleaseForRequest } from '../lib/release-normalization.js';
import { getReleaseRequestIdentity, getSelfRequestedReleaseKeys } from '../lib/release-request-identity.js';
import { sessionStore } from '../state/session.js';
import { useToast } from './useToast.js';

/**
 * Suppress duplicate submissions per actor, recipient, and release within this
 * composable. Omitted recipient means the current session user. Initial IDs and
 * the legacy exposed ID sets describe self requests only, never all recipients.
 * This local state is not server authorization or durable request history.
 */
export function useReleaseRequest({
  initialRequestedIds = [],
  showToasts = true,
  submitRequest = createMediaRequest,
  toast = useToast(),
  getCurrentUserId = () => sessionStore.state.user?.id ?? null,
} = {}) {
  function identity(releaseOrKey, options = {}) {
    return getReleaseRequestIdentity(releaseOrKey, { ...options, currentUserId: getCurrentUserId() });
  }
  const requested = ref(new Map(initialRequestedIds.map((releaseKey) => {
    const entry = identity(releaseKey);
    return entry ? [entry.key, entry] : null;
  }).filter(Boolean)));
  const requesting = ref(new Map());
  const requestedIds = computed(() => getSelfRequestedReleaseKeys(requested.value, getCurrentUserId()));
  const requestingIds = computed(() => getSelfRequestedReleaseKeys(requesting.value, getCurrentUserId()));

  function isRequesting(releaseOrKey, options) {
    const entry = identity(releaseOrKey, options);
    return entry ? requesting.value.has(entry.key) : false;
  }
  function isRequested(releaseOrKey, options) {
    const entry = identity(releaseOrKey, options);
    return entry ? requested.value.has(entry.key) : false;
  }
  function canRequest(release, options) {
    return canRequestRelease(release) && Boolean(identity(release, options))
      && !isRequesting(release, options) && !isRequested(release, options);
  }

  async function requestRelease(release, { requestedForUserId = null } = {}) {
    const entry = identity(release, { requestedForUserId });
    const basePayload = normalizeReleaseForRequest(release);
    if (!entry || !basePayload) {
      const error = new Error('Cannot request this release: missing required fields or recipient.');
      if (showToasts) toast.error(error.message);
      return { ok: false, error };
    }
    if (requested.value.has(entry.key)) return { ok: true, skipped: true, reason: 'requested' };
    if (requesting.value.has(entry.key)) return { ok: false, skipped: true, reason: 'requesting' };
    const payload = requestedForUserId === null
      ? basePayload : { ...basePayload, requestedForUserId: entry.recipientUserId };
    requesting.value.set(entry.key, entry);
    try {
      const result = await submitRequest(payload);
      requested.value.set(entry.key, entry);
      if (showToasts && getCurrentUserId() === entry.actorUserId) {
        const linked = result?.mediaRequest?.linked ?? result?.linked ?? false;
        if (linked) {
          toast.info(`Someone already requested ${payload.releaseTitle} by ${payload.artistName} — the selected recipient has been added to the queue.`);
        } else {
          toast.success(`Requested ${payload.releaseTitle} by ${payload.artistName}.`);
        }
      }
      return { ok: true };
    } catch (error) {
      if (showToasts && getCurrentUserId() === entry.actorUserId) {
        toast.error(getErrorMessage(error, `Could not request ${payload.releaseTitle}. Please try again.`));
      }
      return { ok: false, error };
    } finally {
      requesting.value.delete(entry.key);
    }
  }

  return { requestedIds, requestingIds, canRequest, isRequested, isRequesting, requestRelease };
}
