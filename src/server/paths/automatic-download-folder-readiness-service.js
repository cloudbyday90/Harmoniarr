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

import { createPathValidationService } from './path-validation-service.js';

export const AUTOMATIC_DOWNLOAD_SETUP_REASONS = Object.freeze({
  DOWNLOAD_FOLDER_UNAVAILABLE: 'download_folder_unavailable',
  MISSING_DOWNLOAD_FOLDER: 'missing_download_folder',
});

const REQUIRED_ROOT_KEYS = Object.freeze(['downloads', 'staging', 'music']);

function hasConfiguredPath(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildBlockedReadiness(reason) {
  const message = reason === AUTOMATIC_DOWNLOAD_SETUP_REASONS.MISSING_DOWNLOAD_FOLDER
    ? 'Finish folder setup before Harmoniarr can start downloads automatically.'
    : 'Harmoniarr cannot reach a required download or library folder.';

  return {
    message,
    ready: false,
    reason,
  };
}

function hasRequiredFolderConfiguration(paths) {
  if (!paths || typeof paths !== 'object') {
    return false;
  }

  return REQUIRED_ROOT_KEYS.every((key) => hasConfiguredPath(paths[key]))
    && Array.isArray(paths.downloadMappings)
    && paths.downloadMappings.length > 0;
}

function findRoot(validation, key) {
  return Array.isArray(validation?.roots)
    ? validation.roots.find((root) => root?.key === key) ?? null
    : null;
}

function hasHealthyRequiredRoots(validation) {
  return REQUIRED_ROOT_KEYS.every((key) => findRoot(validation, key)?.status === 'healthy');
}

function hasHealthyDownloadMapping(validation) {
  return Array.isArray(validation?.downloadMappings)
    && validation.downloadMappings.some((mapping) => mapping?.status === 'healthy');
}

export function createAutomaticDownloadFolderReadinessService({
  validateSettingsPaths = createPathValidationService().validateSettingsPaths,
} = {}) {
  async function getAutomaticDownloadFolderReadiness({ settings } = {}) {
    if (!hasRequiredFolderConfiguration(settings?.paths)) {
      return buildBlockedReadiness(AUTOMATIC_DOWNLOAD_SETUP_REASONS.MISSING_DOWNLOAD_FOLDER);
    }

    if (typeof validateSettingsPaths !== 'function') {
      return buildBlockedReadiness(AUTOMATIC_DOWNLOAD_SETUP_REASONS.DOWNLOAD_FOLDER_UNAVAILABLE);
    }

    let validation;
    try {
      validation = await validateSettingsPaths(settings);
    } catch {
      return buildBlockedReadiness(AUTOMATIC_DOWNLOAD_SETUP_REASONS.DOWNLOAD_FOLDER_UNAVAILABLE);
    }

    if (!hasHealthyRequiredRoots(validation) || !hasHealthyDownloadMapping(validation)) {
      return buildBlockedReadiness(AUTOMATIC_DOWNLOAD_SETUP_REASONS.DOWNLOAD_FOLDER_UNAVAILABLE);
    }

    return { ready: true };
  }

  return {
    getAutomaticDownloadFolderReadiness,
  };
}
