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

import { apiRequest, buildQueryString } from './api.js';

export function fetchImportCandidates({
  folderPath,
  limit,
  offset,
  sourceSearchId,
  status,
  username,
} = {}) {
  return apiRequest(`/api/v1/import-candidates${buildQueryString({
    folderPath,
    limit,
    offset,
    sourceSearchId,
    status,
    username,
  })}`);
}

export function fetchImportCandidate(importCandidateId) {
  return apiRequest(`/api/v1/import-candidates/${encodeURIComponent(importCandidateId)}`);
}

export function fetchImportCandidatePreview(importCandidateId) {
  return apiRequest(`/api/v1/import-candidates/${encodeURIComponent(importCandidateId)}/preview`);
}

export function fetchImportCandidateApplyPreview(importCandidateId) {
  return apiRequest(`/api/v1/import-candidates/${encodeURIComponent(importCandidateId)}/apply-preview`);
}

function updateImportCandidateFileDecision(importCandidateId, importCandidateFileId, action, reason) {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

  return apiRequest(
    `/api/v1/import-candidates/${encodeURIComponent(importCandidateId)}/files/${encodeURIComponent(importCandidateFileId)}/${action}`,
    {
      method: 'POST',
      includeCsrf: true,
      body: normalizedReason ? { reason: normalizedReason } : {},
    },
  );
}

export function skipImportCandidateFile(importCandidateId, importCandidateFileId, reason) {
  return updateImportCandidateFileDecision(importCandidateId, importCandidateFileId, 'skip', reason);
}

export function allowImportCandidateFileLossyDerivative(importCandidateId, importCandidateFileId, reason) {
  return updateImportCandidateFileDecision(importCandidateId, importCandidateFileId, 'allow-lossy-derivative', reason);
}

export function clearImportCandidateFileDecision(importCandidateId, importCandidateFileId, reason) {
  return updateImportCandidateFileDecision(importCandidateId, importCandidateFileId, 'clear-decision', reason);
}

export function fetchSelectedImportCandidateSummary({
  limit,
} = {}) {
  return apiRequest(`/api/v1/import-candidates/selected-summary${buildQueryString({ limit })}`);
}

export function fetchImportPendingCandidateSummary({
  limit,
} = {}) {
  return apiRequest(`/api/v1/import-candidates/import-pending-summary${buildQueryString({ limit })}`);
}

export function fetchImportCandidateExecutionSummary() {
  return apiRequest('/api/v1/import-candidates/execution-summary');
}

export function fetchImportCandidateExecutionRunDetail(runId) {
  return apiRequest(`/api/v1/import-candidates/execution-runs/${encodeURIComponent(runId)}`);
}

export function fetchImportCandidateApplySummary() {
  return apiRequest('/api/v1/import-candidates/apply-summary');
}

export function fetchImportCandidateApplyRunDetail(runId) {
  return apiRequest(`/api/v1/import-candidates/apply-runs/${encodeURIComponent(runId)}`);
}

export function fetchImportCandidateMediaInspectionSummary() {
  return apiRequest('/api/v1/import-candidates/media-inspection-summary');
}

export function fetchImportCandidateMediaInspectionRunDetail(runId) {
  return apiRequest(`/api/v1/import-candidates/media-inspection-runs/${encodeURIComponent(runId)}`);
}

export function startImportCandidateExecutionRun() {
  return apiRequest('/api/v1/import-candidates/execution-runs', {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

export function startImportCandidateApplyRun() {
  return apiRequest('/api/v1/import-candidates/apply-runs', {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

export function startImportCandidateMediaInspectionRun() {
  return apiRequest('/api/v1/import-candidates/media-inspection-runs', {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

export function reconcileImportCandidateExecutionState() {
  return apiRequest('/api/v1/import-candidates/execution-reconcile', {
    method: 'POST',
    includeCsrf: true,
    body: {},
  });
}

function transitionImportCandidate(importCandidateId, action, reason) {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

  return apiRequest(`/api/v1/import-candidates/${encodeURIComponent(importCandidateId)}/${action}`, {
    method: 'POST',
    includeCsrf: true,
    body: normalizedReason ? { reason: normalizedReason } : {},
  });
}

export function holdImportCandidate(importCandidateId, reason) {
  return transitionImportCandidate(importCandidateId, 'hold', reason);
}

export function selectImportCandidate(importCandidateId, reason) {
  return transitionImportCandidate(importCandidateId, 'select', reason);
}

export function rejectImportCandidate(importCandidateId, reason) {
  return transitionImportCandidate(importCandidateId, 'reject', reason);
}

export function reopenImportCandidate(importCandidateId, reason) {
  return transitionImportCandidate(importCandidateId, 'reopen', reason);
}

export function bulkReviewImportCandidates({ action, importCandidateIds, reason } = {}) {
  return apiRequest('/api/v1/import-candidates/bulk-review', {
    method: 'POST',
    includeCsrf: true,
    body: { action, importCandidateIds, reason: reason || undefined },
  });
}
