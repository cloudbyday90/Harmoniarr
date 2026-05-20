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

export function buildFileOperationResult({
  destinationPath = null,
  errorMessage = null,
  fileId = null,
  filename = null,
  finishedAt = null,
  sourcePath = null,
  startedAt = null,
  status,
  steps = [],
  transport = null,
  verification = null,
} = {}) {
  return {
    destinationPath,
    errorMessage,
    fileId,
    filename,
    finishedAt,
    sourcePath,
    startedAt,
    status,
    steps,
    transport,
    verification,
  };
}

export function buildOperationResultSummary({
  failedCount = 0,
  notAttemptedCount = 0,
  skippedCount = 0,
  succeededCount = 0,
  totalItems = 0,
} = {}) {
  return {
    failedCount,
    notAttemptedCount,
    skippedCount,
    succeededCount,
    totalItems,
  };
}

export function classifyOperationOutcome({
  failedCount: _failedCount = 0,
  succeededCount = 0,
  totalItems = 0,
} = {}) {
  if (totalItems === 0) {
    return 'empty';
  }

  if (succeededCount === totalItems) {
    return 'completed';
  }

  if (succeededCount === 0) {
    return 'failed';
  }

  return 'partial';
}

export function buildOperationResultBreakdown(fileResults = []) {
  const failedCount = fileResults.filter((r) => r.status === 'failed').length;
  const notAttemptedCount = fileResults.filter((r) => r.status === 'not_attempted').length;
  const skippedCount = fileResults.filter((r) => r.status === 'skipped').length;
  const succeededCount = fileResults.filter((r) => r.status === 'applied' || r.status === 'moved').length;
  const totalItems = fileResults.length;

  return {
    ...buildOperationResultSummary({
      failedCount,
      notAttemptedCount,
      skippedCount,
      succeededCount,
      totalItems,
    }),
    outcome: classifyOperationOutcome({
      failedCount,
      succeededCount,
      totalItems: totalItems - skippedCount - notAttemptedCount,
    }),
  };
}
