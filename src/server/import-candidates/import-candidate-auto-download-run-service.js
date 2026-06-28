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

import { loadSettings } from '../settings.js';

export const AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE = 'auto_selection';

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildSkippedResult({ attempted = true, selectedCandidateId = null, sourceSearchId = null, ...extras } = {}) {
  return {
    attempted,
    selectedCandidateId,
    sourceSearchId,
    started: false,
    ...extras,
  };
}

function resolveAutoStartEnabled(settings) {
  const value = settings?.library?.autoStartDownloadsAfterSelection;
  return value === undefined ? true : value === true;
}

export function createImportCandidateAutoDownloadRunService({
  getProviderStatus = null,
  loadSettingsFn = loadSettings,
  startImportCandidateExecutionRun = null,
} = {}) {
  async function startDownloadRunAfterAutoSelection({
    actorUserId = null,
    autoSelectionResult = null,
    requestMetadata = null,
    sourceSearchId = null,
  } = {}) {
    const normalizedSelectedCandidateId = normalizeOptionalString(autoSelectionResult?.selectedCandidateId);
    const normalizedSourceSearchId = normalizeOptionalString(sourceSearchId ?? autoSelectionResult?.sourceSearchId);

    if (autoSelectionResult?.selected !== true || !normalizedSelectedCandidateId) {
      return buildSkippedResult({
        attempted: false,
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: 'auto_selection_not_selected',
        sourceSearchId: normalizedSourceSearchId,
      });
    }

    let settings;
    try {
      settings = await loadSettingsFn();
    } catch (error) {
      return buildSkippedResult({
        errorCode: error?.code ?? 'settings_unavailable',
        message: error?.message ?? 'Settings unavailable',
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: 'settings_unavailable',
        sourceSearchId: normalizedSourceSearchId,
      });
    }

    if (!resolveAutoStartEnabled(settings)) {
      return buildSkippedResult({
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: 'automatic_download_start_disabled',
        sourceSearchId: normalizedSourceSearchId,
      });
    }

    if (typeof startImportCandidateExecutionRun !== 'function') {
      return buildSkippedResult({
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: 'download_start_unavailable',
        sourceSearchId: normalizedSourceSearchId,
      });
    }

    if (typeof getProviderStatus === 'function') {
      try {
        const providerStatus = await getProviderStatus();
        if (providerStatus?.status !== 'healthy') {
          return buildSkippedResult({
            message: providerStatus?.message ?? null,
            provider: 'slskd',
            providerStatus: providerStatus?.status ?? 'unknown',
            selectedCandidateId: normalizedSelectedCandidateId,
            skippedReason: 'provider_not_healthy',
            sourceSearchId: normalizedSourceSearchId,
          });
        }
      } catch (error) {
        return buildSkippedResult({
          errorCode: error?.code ?? 'provider_status_unavailable',
          message: error?.message ?? 'Soulseek provider status unavailable',
          provider: 'slskd',
          selectedCandidateId: normalizedSelectedCandidateId,
          skippedReason: 'provider_status_unavailable',
          sourceSearchId: normalizedSourceSearchId,
        });
      }
    } else {
      return buildSkippedResult({
        provider: 'slskd',
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: 'provider_status_unavailable',
        sourceSearchId: normalizedSourceSearchId,
      });
    }

    try {
      const result = await startImportCandidateExecutionRun({
        requestMetadata,
        selectedCandidateId: normalizedSelectedCandidateId,
        sourceSearchId: normalizedSourceSearchId,
        triggeredByUserId: actorUserId,
        triggerSource: AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE,
      });

      return {
        attempted: true,
        runId: result?.run?.id ?? null,
        selectedCandidateId: normalizedSelectedCandidateId,
        sourceSearchId: normalizedSourceSearchId,
        started: true,
        triggerSource: AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE,
      };
    } catch (error) {
      return buildSkippedResult({
        errorCode: error?.code ?? 'auto_download_start_failed',
        message: error?.message ?? 'Automatic download start failed',
        selectedCandidateId: normalizedSelectedCandidateId,
        skippedReason: error?.code ?? 'auto_download_start_failed',
        sourceSearchId: normalizedSourceSearchId,
      });
    }
  }

  return {
    startDownloadRunAfterAutoSelection,
  };
}
