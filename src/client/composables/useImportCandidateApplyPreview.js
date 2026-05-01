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
import { fetchImportCandidateApplyPreview } from '../lib/import-candidate-api.js';

export function useImportCandidateApplyPreview({
  fetchApplyPreview = fetchImportCandidateApplyPreview,
} = {}) {
  const applyPreview = ref(null);
  const applyPreviewError = ref('');
  const isLoadingApplyPreview = ref(false);

  function clearApplyPreview() {
    applyPreview.value = null;
    applyPreviewError.value = '';
  }

  async function loadApplyPreview(importCandidateId) {
    if (!importCandidateId) {
      clearApplyPreview();
      return null;
    }

    applyPreviewError.value = '';
    isLoadingApplyPreview.value = true;

    try {
      const payload = await fetchApplyPreview(importCandidateId);
      applyPreview.value = payload.importCandidateApplyPreview ?? null;
      return applyPreview.value;
    } catch (error) {
      applyPreview.value = null;
      applyPreviewError.value = getErrorMessage(error, 'Import apply preview failed to load');
      return null;
    } finally {
      isLoadingApplyPreview.value = false;
    }
  }

  return {
    applyPreview,
    applyPreviewError,
    clearApplyPreview,
    isLoadingApplyPreview,
    loadApplyPreview,
  };
}