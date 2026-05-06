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
import { getErrorMessage } from '../lib/error-utils.js';
import { createMediaRequest } from '../lib/library-api.js';
import {
  canRequestRelease,
  getReleaseRequestKey,
  normalizeReleaseForRequest,
} from '../lib/release-normalization.js';
import { useToast } from './useToast.js';

/**
 * Composable that owns the release request submission workflow and state.
 *
 * Tracks which releases are currently being requested (`requestingIds`) and
 * which have been successfully requested (`requestedIds`). Both sets are
 * reassigned (not mutated) on each update to ensure Vue reactivity.
 *
 * Guard rules:
 * - If a release key is already in `requestingIds`, a second call is a no-op.
 * - If a release key is already in `requestedIds`, a second call is a no-op.
 *
 * @param {object} [options]
 * @param {string[]} [options.initialRequestedIds] - Release request keys to
 *   treat as already requested at construction time.
 * @param {boolean} [options.showToasts] - When true (default), success/error
 *   toasts are shown automatically.
 * @param {function} [options.submitRequest] - Override for testing.
 * @param {object} [options.toast] - Override for testing.
 */
export function useReleaseRequest({
  initialRequestedIds = [],
  showToasts = true,
  submitRequest = createMediaRequest,
  toast = useToast(),
} = {}) {

  /**
   * Set of release request keys that have been successfully requested.
   * Reassigned (not mutated) on each update to ensure Vue reactivity.
   */
  const requestedIds = ref(new Set(initialRequestedIds));

  /**
   * Set of release request keys for which a request operation is currently
   * in progress. Reassigned (not mutated) on each update.
   */
  const requestingIds = ref(new Set());

  /**
   * Returns true if the given release key or release object is currently
   * being requested.
   *
   * @param {string|object} releaseOrKey
   * @returns {boolean}
   */
  function isRequesting(releaseOrKey) {
    const key = typeof releaseOrKey === 'string'
      ? releaseOrKey
      : getReleaseRequestKey(releaseOrKey);
    return key ? requestingIds.value.has(key) : false;
  }

  /**
   * Returns true if the given release key or release object has already been
   * successfully requested.
   *
   * @param {string|object} releaseOrKey
   * @returns {boolean}
   */
  function isRequested(releaseOrKey) {
    const key = typeof releaseOrKey === 'string'
      ? releaseOrKey
      : getReleaseRequestKey(releaseOrKey);
    return key ? requestedIds.value.has(key) : false;
  }

  /**
   * Returns true if the given release can be requested (has required fields
   * and has not already been requested or is not currently being requested).
   *
   * @param {object} release
   * @returns {boolean}
   */
  function canRequest(release) {
    if (!canRequestRelease(release)) return false;
    const key = getReleaseRequestKey(release);
    if (!key) return false;
    return !requestingIds.value.has(key) && !requestedIds.value.has(key);
  }

  /**
   * Submit a media request for the given release.
   *
   * Returns:
   * - `{ ok: true }` on success
   * - `{ ok: true, skipped: true, reason: 'requested' }` if already requested
   * - `{ ok: false, skipped: true, reason: 'requesting' }` if already in flight
   * - `{ ok: false, error }` on failure
   *
   * @param {object} release
   * @returns {Promise<object>}
   */
  async function requestRelease(release) {
    const key = getReleaseRequestKey(release);

    // Cannot derive a stable key — this release is not requestable.
    if (!key) {
      const error = new Error('Cannot request this release: missing required fields.');
      if (showToasts) {
        toast.error('Cannot request this release: missing required fields.');
      }
      return { ok: false, error };
    }

    // Already requested — skip silently.
    if (requestedIds.value.has(key)) {
      return { ok: true, skipped: true, reason: 'requested' };
    }

    // Already in flight — skip silently.
    if (requestingIds.value.has(key)) {
      return { ok: false, skipped: true, reason: 'requesting' };
    }

    const payload = normalizeReleaseForRequest(release);
    if (!payload) {
      const error = new Error('Cannot request this release: missing artist name or release title.');
      if (showToasts) {
        toast.error('Cannot request this release: missing required fields.');
      }
      return { ok: false, error };
    }

    // Mark as in-progress (reassign to trigger reactivity).
    requestingIds.value = new Set([...requestingIds.value, key]);

    try {
      await submitRequest(payload);

      // Move from in-progress to complete.
      const nextRequesting = new Set(requestingIds.value);
      nextRequesting.delete(key);
      requestingIds.value = nextRequesting;

      requestedIds.value = new Set([...requestedIds.value, key]);

      if (showToasts) {
        toast.success(`Requested ${payload.releaseTitle} by ${payload.artistName}.`);
      }

      return { ok: true };
    } catch (error) {
      const nextRequesting = new Set(requestingIds.value);
      nextRequesting.delete(key);
      requestingIds.value = nextRequesting;

      if (showToasts) {
        toast.error(getErrorMessage(
          error,
          `Could not request ${payload.releaseTitle}. Please try again.`,
        ));
      }

      return { ok: false, error };
    }
  }

  return {
    requestedIds,
    requestingIds,
    canRequest,
    isRequested,
    isRequesting,
    requestRelease,
  };
}
