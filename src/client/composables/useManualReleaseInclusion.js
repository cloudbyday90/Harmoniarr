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
import { includeOperatorArtistReleaseManually as defaultIncludeOperatorArtistReleaseManually } from '../lib/metadata-api.js';
import { useToast } from './useToast.js';

function getManualInclusionKey(releaseOrKey) {
  if (typeof releaseOrKey === 'string') {
    return releaseOrKey;
  }

  const metadataArtistId = releaseOrKey?.metadataArtistId;
  const metadataReleaseGroupId = releaseOrKey?.metadataReleaseGroupId;
  const metadataReleaseId = releaseOrKey?.metadataReleaseId;
  if (![metadataArtistId, metadataReleaseGroupId, metadataReleaseId].every(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )) {
    return null;
  }

  return `manual-inclusion:${metadataArtistId}:${metadataReleaseGroupId}:${metadataReleaseId}`;
}

function getReleaseTitle(release) {
  return typeof release?.title === 'string' && release.title.trim().length > 0
    ? release.title.trim()
    : 'this release';
}

export function getManualSelectionLabel(release) {
  return release?.selectionState === 'partial'
    ? 'Manual partial selection'
    : 'Manual inclusion';
}

/**
 * Owns Missing Music's narrow "keep selected manually" action. A local set
 * keeps the card truthful while the asynchronous reconciliation projection is
 * catching up with the newly saved snapshot.
 */
export function useManualReleaseInclusion({
  includeReleaseManually = defaultIncludeOperatorArtistReleaseManually,
  showToasts = true,
  toast = useToast(),
} = {}) {
  const includedKeys = ref(new Set());
  const includingKeys = ref(new Set());

  function isIncluding(releaseOrKey) {
    const key = getManualInclusionKey(releaseOrKey);
    return Boolean(key && includingKeys.value.has(key));
  }

  function isManualSelection(releaseOrKey) {
    if (typeof releaseOrKey !== 'string' && releaseOrKey?.selectionSource === 'manual') {
      return true;
    }

    const key = getManualInclusionKey(releaseOrKey);
    return Boolean(key && includedKeys.value.has(key));
  }

  function canIncludeManually(release) {
    return Boolean(getManualInclusionKey(release) && !isManualSelection(release));
  }

  async function includeManually(release) {
    const key = getManualInclusionKey(release);
    if (!key) {
      const error = new Error('Cannot save a manual inclusion because release identity is unavailable.');
      if (showToasts) toast.error(error.message);
      return { ok: false, error };
    }

    if (isManualSelection(release)) {
      return { ok: true, skipped: true, reason: 'already_included' };
    }

    if (includingKeys.value.has(key)) {
      return { ok: false, skipped: true, reason: 'including' };
    }

    includingKeys.value = new Set([...includingKeys.value, key]);

    try {
      const result = await includeReleaseManually({
        metadataArtistId: release.metadataArtistId,
        metadataReleaseGroupId: release.metadataReleaseGroupId,
        metadataReleaseId: release.metadataReleaseId,
      });
      includingKeys.value = new Set([...includingKeys.value].filter((entry) => entry !== key));
      includedKeys.value = new Set([...includedKeys.value, key]);

      if (showToasts) {
        const message = result?.alreadyIncluded
          ? `Manual inclusion was already saved for ${getReleaseTitle(release)}.`
          : `Saved manual inclusion for ${getReleaseTitle(release)}. Reconciliation queued.`;
        toast.success(message);
      }

      return { ok: true, alreadyIncluded: result?.alreadyIncluded === true };
    } catch (error) {
      includingKeys.value = new Set([...includingKeys.value].filter((entry) => entry !== key));
      if (showToasts) {
        toast.error(getErrorMessage(
          error,
          `Could not save a manual inclusion for ${getReleaseTitle(release)}. Please try again.`,
        ));
      }
      return { ok: false, error };
    }
  }

  return {
    canIncludeManually,
    includeManually,
    includedKeys,
    includingKeys,
    isIncluding,
    isManualSelection,
  };
}
