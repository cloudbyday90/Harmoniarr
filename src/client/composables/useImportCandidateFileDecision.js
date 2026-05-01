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
import {
  clearImportCandidateFileDecision,
  skipImportCandidateFile,
} from '../lib/import-candidate-api.js';

export function useImportCandidateFileDecision({
  clearDecision = clearImportCandidateFileDecision,
  setSkipDecision = skipImportCandidateFile,
} = {}) {
  const decisionError = ref('');
  const isUpdatingFileDecision = ref(false);
  const pendingFileDecisionId = ref('');

  async function runDecision(action, {
    fallbackMessage,
    importCandidateFileId,
    importCandidateId,
    reason,
  }) {
    if (!importCandidateId || !importCandidateFileId) {
      return null;
    }

    decisionError.value = '';
    isUpdatingFileDecision.value = true;
    pendingFileDecisionId.value = importCandidateFileId;

    try {
      return await action(importCandidateId, importCandidateFileId, reason);
    } catch (error) {
      decisionError.value = getErrorMessage(error, fallbackMessage);
      return null;
    } finally {
      isUpdatingFileDecision.value = false;
      pendingFileDecisionId.value = '';
    }
  }

  function skipFile(importCandidateId, importCandidateFileId, reason) {
    return runDecision(setSkipDecision, {
      fallbackMessage: 'Saving the file skip decision failed',
      importCandidateFileId,
      importCandidateId,
      reason,
    });
  }

  function clearFileDecision(importCandidateId, importCandidateFileId, reason) {
    return runDecision(clearDecision, {
      fallbackMessage: 'Clearing the file skip decision failed',
      importCandidateFileId,
      importCandidateId,
      reason,
    });
  }

  return {
    clearFileDecision,
    decisionError,
    isUpdatingFileDecision,
    pendingFileDecisionId,
    skipFile,
  };
}