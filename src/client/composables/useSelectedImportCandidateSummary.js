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

import { fetchSelectedImportCandidateSummary } from '../lib/import-candidate-api.js';
import { useImportCandidateStageSummary } from './useImportCandidateStageSummary.js';

function createEmptyCounts() {
  return {
    blocked: 0,
    ready: 0,
    readyWithWarnings: 0,
    totalSelected: 0,
  };
}

export function useSelectedImportCandidateSummary({
  fetchSummary = fetchSelectedImportCandidateSummary,
} = {}) {
  const workflow = useImportCandidateStageSummary({
    candidatesKey: 'selectedCandidates',
    createEmptyCounts,
    fallbackMessage: 'Selected import summary failed to load',
    fetchSummary,
    payloadKey: 'selectedImportCandidates',
  });

  return {
    counts: workflow.counts,
    errorMessage: workflow.errorMessage,
    isLoading: workflow.isLoading,
    loadSelectedSummary: workflow.loadSummary,
    selectedCandidates: workflow.candidates,
    selectedSummary: workflow.stageSummary,
    summary: workflow.summary,
  };
}