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

export const postApplyScanTriggerReason = 'import_candidate_apply';

const safePostApplyScanErrorCodes = new Set([
  'library_scan_in_progress',
  'library_scan_not_ready',
]);

function normalizeError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : null,
    message: error instanceof Error ? error.message : String(error),
    status: Number.isInteger(error?.status) ? error.status : null,
  };
}

export function isSafePostApplyScanError(error) {
  return error?.status === 409 && safePostApplyScanErrorCodes.has(error?.code);
}

export function createImportCandidatePostApplyScanService({
  startLibraryScan = null,
} = {}) {
  async function schedulePostApplyLibraryScan({ triggeredByRunId = null } = {}) {
    if (typeof startLibraryScan !== 'function') {
      return {
        accepted: false,
        reason: 'library_scan_service_unavailable',
        scanRunId: null,
        status: 'unavailable',
        triggeredByRunId,
      };
    }

    try {
      const result = await startLibraryScan({
        triggeredByRunId,
        triggeredByUserId: null,
        triggerReason: postApplyScanTriggerReason,
      });

      return {
        accepted: result?.accepted === true,
        reason: null,
        scanRunId: result?.run?.id ?? null,
        status: 'scheduled',
        triggeredByRunId,
      };
    } catch (error) {
      const normalizedError = normalizeError(error);
      const safeToSuppress = isSafePostApplyScanError(error);

      return {
        accepted: false,
        reason: normalizedError.code ?? normalizedError.message,
        scanRunId: null,
        status: safeToSuppress ? 'suppressed' : 'failed',
        triggeredByRunId,
      };
    }
  }

  return {
    schedulePostApplyLibraryScan,
  };
}
