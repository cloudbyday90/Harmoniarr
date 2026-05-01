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

import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import {
  resolveDownloadCandidateFolder,
  validateDownloadPathMappingsAgainstSettings,
} from './download-path-mapping-service.js';

function getStatusRank(status) {
  switch (status) {
    case 'unavailable':
      return 2;
    case 'degraded':
      return 1;
    default:
      return 0;
  }
}

function mergeStatuses(statuses) {
  return statuses.reduce((highest, status) => (
    getStatusRank(status) > getStatusRank(highest) ? status : highest
  ), 'healthy');
}

function formatErrorMessage(error, fallback) {
  if (typeof error?.code === 'string') {
    return `${fallback} (${error.code})`;
  }

  return fallback;
}

function joinExamplePath(prefix) {
  return `${prefix.replace(/\/+$/g, '')}/Example Artist/Example Album`;
}

export function createPathValidationService({
  accessFn = access,
  realpathFn = realpath,
  statFn = stat,
} = {}) {
  async function validateDirectory({
    key,
    label,
    pathValue,
    requireRead = true,
    requireWrite = false,
  }) {
    const result = {
      key,
      label,
      path: pathValue,
      resolvedPath: null,
      status: 'healthy',
      message: '',
      permissions: {
        read: false,
        write: false,
      },
    };

    try {
      const stats = await statFn(pathValue);
      if (!stats.isDirectory()) {
        return {
          ...result,
          status: 'unavailable',
          message: 'Configured path exists but is not a directory.',
        };
      }
    } catch (error) {
      return {
        ...result,
        status: 'unavailable',
        message: formatErrorMessage(error, 'Configured path is not reachable from Harmoniarr.'),
      };
    }

    try {
      result.resolvedPath = await realpathFn(pathValue);
    } catch {
      result.resolvedPath = null;
    }

    if (requireRead) {
      try {
        await accessFn(pathValue, constants.R_OK);
        result.permissions.read = true;
      } catch (error) {
        return {
          ...result,
          status: 'degraded',
          message: formatErrorMessage(error, 'Configured directory exists but is not readable.'),
        };
      }
    }

    if (requireWrite) {
      try {
        await accessFn(pathValue, constants.W_OK);
        result.permissions.write = true;
      } catch (error) {
        return {
          ...result,
          status: 'degraded',
          message: formatErrorMessage(error, 'Configured directory exists but is not writable.'),
        };
      }
    }

    return {
      ...result,
      message: requireWrite
        ? 'Directory exists and satisfies the required read and write checks.'
        : 'Directory exists and satisfies the required read checks.',
    };
  }

  async function validateSettingsPaths(settings) {
    const roots = await Promise.all([
      validateDirectory({
        key: 'downloads',
        label: 'Downloads root',
        pathValue: settings.paths.downloads,
        requireRead: true,
      }),
      validateDirectory({
        key: 'staging',
        label: 'Staging root',
        pathValue: settings.paths.staging,
        requireRead: true,
        requireWrite: true,
      }),
      validateDirectory({
        key: 'music',
        label: 'Library root',
        pathValue: settings.paths.music,
        requireRead: true,
        requireWrite: true,
      }),
      validateDirectory({
        key: 'transcodeTemp',
        label: 'Transcode temp root',
        pathValue: settings.paths.transcodeTemp,
        requireRead: true,
        requireWrite: true,
      }),
    ]);

    let mappingWarning = null;
    let normalizedMappings = [];

    try {
      normalizedMappings = validateDownloadPathMappingsAgainstSettings({
        downloadMappings: settings.paths.downloadMappings,
        downloadsRoot: settings.paths.downloads,
      });
    } catch (error) {
      mappingWarning = error.message;
    }

    const downloadRoot = roots.find((root) => root.key === 'downloads');
    const downloadMappings = await Promise.all(normalizedMappings.map(async (mapping, index) => {
      const localRoot = await validateDirectory({
        key: `downloadMapping-${index}`,
        label: `Download mapping ${index + 1}`,
        pathValue: mapping.harmoniarrPrefix,
        requireRead: true,
      });
      const resolution = resolveDownloadCandidateFolder({
        candidateFolderPath: joinExamplePath(mapping.slskdPrefix),
        downloadMappings: [mapping],
        downloadsRoot: settings.paths.downloads,
      });

      return {
        index,
        slskdPrefix: mapping.slskdPrefix,
        harmoniarrPrefix: mapping.harmoniarrPrefix,
        exampleSourcePath: joinExamplePath(mapping.slskdPrefix),
        exampleTranslatedPath: resolution.resolvedFolderPath,
        status: localRoot.status,
        message: localRoot.message,
      };
    }));

    const summaryStatus = mergeStatuses([
      ...roots.map((root) => root.status),
      ...downloadMappings.map((mapping) => mapping.status),
      mappingWarning ? 'degraded' : 'healthy',
      downloadMappings.length === 0 ? 'degraded' : 'healthy',
    ]);

    return {
      checkedAt: new Date().toISOString(),
      summary: {
        status: summaryStatus,
        message: mappingWarning
          ?? (downloadMappings.length === 0
            ? 'No explicit slskd download mappings are configured yet; preview resolution still falls back to the downloads root assumption.'
            : 'Path validation completed with the current local filesystem checks.'),
      },
      roots,
      downloadMappings,
      notes: {
        remoteSlskdValidation: 'slskd-visible prefixes are modeled as configuration only in this slice; the app validates translated local paths and deterministic example translations without mutating media.',
        downloadsRootResolvedPath: downloadRoot?.resolvedPath ?? null,
      },
    };
  }

  return {
    validateSettingsPaths,
  };
}