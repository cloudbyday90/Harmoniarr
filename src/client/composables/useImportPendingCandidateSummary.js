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

import { fetchImportPendingCandidateSummary } from '../lib/import-candidate-api.js';
import { useImportCandidateStageSummary } from './useImportCandidateStageSummary.js';

function createEmptyCounts() {
  return {
    blocked: 0,
    ready: 0,
    readyWithWarnings: 0,
    totalImportPending: 0,
  };
}

export function useImportPendingCandidateSummary({
  fetchSummary = fetchImportPendingCandidateSummary,
} = {}) {
  const workflow = useImportCandidateStageSummary({
    candidatesKey: 'importPendingCandidates',
    createEmptyCounts,
    fallbackMessage: 'Import-pending summary failed to load',
    fetchSummary,
    payloadKey: 'importPendingCandidates',
  });

  return {
    counts: workflow.counts,
    errorMessage: workflow.errorMessage,
    importPendingCandidates: workflow.candidates,
    importPendingSummary: workflow.stageSummary,
    isLoading: workflow.isLoading,
    loadImportPendingSummary: workflow.loadSummary,
    summary: workflow.summary,
  };
}