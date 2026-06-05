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

function requesterSourceKey(index = 0) {
  return `source-${index + 1}`;
}

export function buildRequesterCandidateSourceLabel(index = 0) {
  return `Source ${index + 1}`;
}

function projectRequesterRunItem(runItem) {
  if (!runItem) {
    return null;
  }

  return {
    finishedAt: runItem.finishedAt ?? null,
    itemStatus: runItem.itemStatus ?? null,
    runStatus: runItem.runStatus ?? null,
    startedAt: runItem.startedAt ?? null,
  };
}

function projectOperatorRunItem(runItem) {
  if (!runItem) {
    return null;
  }

  return {
    operationRunId: runItem.operationRunId,
    importCandidateId: runItem.importCandidateId,
    itemStatus: runItem.itemStatus,
    statusMessage: runItem.statusMessage,
    startedAt: runItem.startedAt,
    finishedAt: runItem.finishedAt,
    runStatus: runItem.runStatus,
    runErrorMessage: runItem.runErrorMessage,
  };
}

export function projectMediaRequestPipelineCandidate(candidate, {
  actorUserRole,
  index,
  transferProgress,
} = {}) {
  const sourceLabel = buildRequesterCandidateSourceLabel(index);
  const canViewOperatorDiagnostics = actorUserRole === 'admin' || actorUserRole === 'operator';

  if (!canViewOperatorDiagnostics) {
    return {
      sourceKey: requesterSourceKey(index),
      sourceLabel,
      status: candidate.status,
      fileCount: candidate.fileCount,
      totalSizeBytes: candidate.totalSizeBytes,
      execution: projectRequesterRunItem(candidate.execution),
      apply: projectRequesterRunItem(candidate.apply),
      transferProgress,
    };
  }

  return {
    ...candidate,
    sourceKey: candidate.id,
    sourceLabel,
    execution: projectOperatorRunItem(candidate.execution),
    apply: projectOperatorRunItem(candidate.apply),
    transferProgress,
  };
}
