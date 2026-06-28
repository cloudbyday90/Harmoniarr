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

const MAX_REASON_CODES = 8;

function countResponseFiles(response) {
  const fileCount = Array.isArray(response?.files) ? response.files.length : 0;
  const lockedFileCount = Array.isArray(response?.lockedFiles) ? response.lockedFiles.length : 0;
  return {
    fileCount: fileCount + lockedFileCount,
    lockedFileCount,
  };
}

function sumResponseFiles(responses) {
  return (Array.isArray(responses) ? responses : []).reduce((summary, response) => {
    const counts = countResponseFiles(response);
    return {
      fileCount: summary.fileCount + counts.fileCount,
      lockedFileCount: summary.lockedFileCount + counts.lockedFileCount,
    };
  }, { fileCount: 0, lockedFileCount: 0 });
}

function appendReasonCode(reasonCodes, reasonCode) {
  if (!reasonCode || reasonCodes.includes(reasonCode) || reasonCodes.length >= MAX_REASON_CODES) {
    return reasonCodes;
  }
  return [...reasonCodes, reasonCode];
}

export function createSlskdIngestionDiagnostics({
  filteredResponses = [],
  filterSummary = {},
  responses = [],
} = {}) {
  const responseList = Array.isArray(responses) ? responses : [];
  const filteredResponseList = Array.isArray(filteredResponses) ? filteredResponses : [];
  const sourceFileCounts = sumResponseFiles(responseList);
  const filteredFileCounts = sumResponseFiles(filteredResponseList);

  return {
    blacklistedFileCount: Number.parseInt(String(filterSummary.blacklistedFileCount ?? 0), 10) || 0,
    candidateCount: 0,
    emptyResponseCount: Number.parseInt(String(filterSummary.emptyResponseCount ?? 0), 10) || 0,
    fileCount: 0,
    filteredFileCount: filteredFileCounts.fileCount,
    filteredLockedFileCount: filteredFileCounts.lockedFileCount,
    filteredResponseCount: filteredResponseList.length,
    ignoredUserResponseCount: Number.parseInt(String(filterSummary.ignoredUserResponseCount ?? 0), 10) || 0,
    malformedFileCount: 0,
    missingUsernameResponseCount: 0,
    provider: 'slskd',
    reasonCodes: [],
    responseCount: responseList.length,
    responseFileCount: sourceFileCounts.fileCount,
    responseLockedFileCount: sourceFileCounts.lockedFileCount,
  };
}

export function finalizeSlskdIngestionDiagnostics(diagnostics, {
  candidateCount,
  fileCount,
} = {}) {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return null;
  }

  let reasonCodes = Array.isArray(diagnostics.reasonCodes)
    ? diagnostics.reasonCodes.filter((reasonCode) => typeof reasonCode === 'string' && reasonCode.trim())
    : [];

  const normalized = {
    ...diagnostics,
    candidateCount: Number.parseInt(String(candidateCount ?? diagnostics.candidateCount ?? 0), 10) || 0,
    fileCount: Number.parseInt(String(fileCount ?? diagnostics.fileCount ?? 0), 10) || 0,
  };

  if (normalized.candidateCount === 0) {
    if (normalized.responseCount === 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'no_provider_responses');
    }
    if (normalized.responseCount > 0 && normalized.responseFileCount === 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'no_usable_files');
    }
    if (normalized.filteredResponseCount === 0 && normalized.responseCount > 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'all_responses_filtered');
    }
    if (normalized.ignoredUserResponseCount > 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'ignored_uploaders');
    }
    if (normalized.blacklistedFileCount > 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'blacklisted_files');
    }
    if (normalized.missingUsernameResponseCount > 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'missing_uploader_identity');
    }
    if (normalized.malformedFileCount > 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'malformed_file_payload');
    }
    if (reasonCodes.length === 0) {
      reasonCodes = appendReasonCode(reasonCodes, 'no_candidate_folders');
    }
  }

  return {
    ...normalized,
    reasonCodes,
  };
}
