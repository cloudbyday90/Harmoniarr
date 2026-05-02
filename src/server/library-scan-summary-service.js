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

import { createApiError } from './auth.js';
import { createSettingsService } from './settings-service.js';
import { createLibraryScanRunStore } from './library/library-scan-run-store.js';
import { buildLibraryScanContext } from './library/library-scan-readiness.js';

function buildSummary({ latestRun, readiness }) {
  if (readiness.status === 'blocked') {
    return {
      status: 'blocked',
      message: readiness.message,
    };
  }

  if (!latestRun) {
    return {
      status: 'not_started',
      message: 'Library paths are ready, but no library scan has been recorded yet.',
    };
  }

  switch (latestRun.status) {
    case 'completed':
      return {
        status: 'completed',
        message: latestRun.filesSeen == null
          ? 'The latest library scan completed successfully.'
          : `The latest library scan completed after inspecting ${latestRun.filesSeen} file${latestRun.filesSeen === 1 ? '' : 's'}.`,
      };
    case 'running':
      return {
        status: 'running',
        message: 'A library scan is currently running.',
      };
    case 'pending':
      return {
        status: 'pending',
        message: 'A library scan has been queued but has not started yet.',
      };
    case 'cancelled':
      return {
        status: 'cancelled',
        message: 'The latest library scan was cancelled before completion.',
      };
    default:
      return {
        status: 'failed',
        message: latestRun.errorMessage
          ? `The latest library scan failed: ${latestRun.errorMessage}`
          : 'The latest library scan did not complete successfully.',
      };
  }
}

export function createLibraryScanSummaryService({
  libraryScanRunStore = createLibraryScanRunStore(),
  settingsService = createSettingsService(),
} = {}) {
  async function buildLibraryScanRunDetail({ runId }) {
    const run = await libraryScanRunStore.getRunById(runId);

    if (!run) {
      throw createApiError(404, 'library_scan_run_not_found', 'Library scan run not found');
    }

    return {
      checkedAt: new Date().toISOString(),
      run,
    };
  }

  async function buildLibraryScanSummary() {
    const checkedAt = new Date().toISOString();
    const settingsPayload = await settingsService.buildSettingsPayload();
    const { libraryRoot, readiness } = buildLibraryScanContext(settingsPayload);
    const latestRun = await libraryScanRunStore.getLatestRun();

    return {
      checkedAt,
      libraryRoot,
      readiness,
      summary: buildSummary({ latestRun, readiness }),
      latestRun,
      nextAction: readiness.status === 'blocked'
        ? {
            label: 'Open Settings',
            to: '/app/settings',
          }
        : null,
    };
  }

  return {
    buildLibraryScanRunDetail,
    buildLibraryScanSummary,
  };
}