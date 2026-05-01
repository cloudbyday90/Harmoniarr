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
import { fetchImportCandidatePreview } from '../lib/import-candidate-api.js';

export function useImportCandidatePreview({
  fetchPreview = fetchImportCandidatePreview,
} = {}) {
  const preview = ref(null);
  const previewError = ref('');
  const isLoadingPreview = ref(false);

  function clearPreview() {
    preview.value = null;
    previewError.value = '';
  }

  async function loadPreview(importCandidateId) {
    if (!importCandidateId) {
      clearPreview();
      return null;
    }

    previewError.value = '';
    isLoadingPreview.value = true;

    try {
      const payload = await fetchPreview(importCandidateId);
      preview.value = payload.importCandidatePreview ?? null;
      return preview.value;
    } catch (error) {
      preview.value = null;
      previewError.value = getErrorMessage(error, 'Import preview failed to load');
      return null;
    } finally {
      isLoadingPreview.value = false;
    }
  }

  return {
    clearPreview,
    isLoadingPreview,
    loadPreview,
    preview,
    previewError,
  };
}