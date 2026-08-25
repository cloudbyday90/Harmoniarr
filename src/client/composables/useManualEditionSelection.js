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
import { selectOperatorArtistReleaseEditionManually as defaultSelectManualEdition } from '../lib/metadata-api.js';
import { useToast } from './useToast.js';

function getSelectionKey(selectionOrKey) {
  if (typeof selectionOrKey === 'string') {
    return selectionOrKey;
  }

  const values = [
    selectionOrKey?.metadataArtistId,
    selectionOrKey?.metadataReleaseGroupId,
    selectionOrKey?.metadataReleaseId,
  ];
  if (!values.every((value) => typeof value === 'string' && value.trim().length > 0)) {
    return null;
  }

  return `manual-edition:${values.join(':')}`;
}

function getReleaseTitle(selection) {
  return typeof selection?.title === 'string' && selection.title.trim().length > 0
    ? selection.title.trim()
    : 'this edition';
}

/**
 * Owns Artist Detail's narrow, persisted edition-selection command. The save
 * does not start a search: it records the operator's choice and queues normal
 * reconciliation. A local in-flight set prevents duplicate submissions.
 */
export function useManualEditionSelection({
  selectManualEdition = defaultSelectManualEdition,
  showToasts = true,
  toast = useToast(),
} = {}) {
  const selectingKeys = ref(new Set());

  function isSelecting(selectionOrKey) {
    const key = getSelectionKey(selectionOrKey);
    return Boolean(key && selectingKeys.value.has(key));
  }

  async function selectEdition(selection) {
    const key = getSelectionKey(selection);
    if (!key) {
      const error = new Error('Cannot save this edition because its release identity is unavailable.');
      if (showToasts) toast.error(error.message);
      return { ok: false, error };
    }

    if (selectingKeys.value.has(key)) {
      return { ok: false, skipped: true, reason: 'selecting' };
    }

    selectingKeys.value = new Set([...selectingKeys.value, key]);

    try {
      const result = await selectManualEdition({
        expectedSnapshotRevision: selection.expectedSnapshotRevision,
        metadataArtistId: selection.metadataArtistId,
        metadataReleaseGroupId: selection.metadataReleaseGroupId,
        metadataReleaseId: selection.metadataReleaseId,
      });
      selectingKeys.value = new Set([...selectingKeys.value].filter((entry) => entry !== key));

      if (showToasts) {
        const message = result?.alreadySelected
          ? `${getReleaseTitle(selection)} is already your selected edition.`
          : `Saved ${getReleaseTitle(selection)} as your selected edition. Reconciliation queued.`;
        toast.success(message);
      }

      return {
        alreadySelected: result?.alreadySelected === true,
        ok: true,
        projection: result?.projection ?? null,
      };
    } catch (error) {
      selectingKeys.value = new Set([...selectingKeys.value].filter((entry) => entry !== key));
      if (showToasts) {
        toast.error(getErrorMessage(
          error,
          `Could not save ${getReleaseTitle(selection)} as your selected edition. Please try again.`,
        ));
      }
      return { ok: false, error };
    }
  }

  return {
    isSelecting,
    selectEdition,
    selectingKeys,
  };
}
