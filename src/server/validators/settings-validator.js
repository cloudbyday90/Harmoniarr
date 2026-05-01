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

import { createApiError } from '../auth.js';
import { normalizeDownloadPathMappings } from '../paths/download-path-mapping-service.js';

function createSettingsValidationError(message) {
  return createApiError(400, 'validation_error', message);
}

const settingDefinitions = {
  system: {
    baseUrl: {
      defaultValue: process.env.HARMONIARR_BASE_URL ?? '',
      normalize(value) {
        if (typeof value !== 'string') {
          throw createSettingsValidationError('system.baseUrl must be a string');
        }

        return value.trim();
      },
    },
    logLevel: {
      defaultValue: process.env.HARMONIARR_LOG_LEVEL ?? 'info',
      normalize(value) {
        const normalized = String(value).trim().toLowerCase();
        if (!['debug', 'info', 'warn', 'error'].includes(normalized)) {
          throw createSettingsValidationError('system.logLevel must be one of debug, info, warn, error');
        }

        return normalized;
      },
    },
  },
  paths: {
    downloads: {
      defaultValue: process.env.HARMONIARR_DOWNLOADS ?? '/data/downloads',
      normalize: normalizePathSetting,
    },
    downloadMappings: {
      defaultValue: [],
      normalize(value) {
        try {
          return normalizeDownloadPathMappings(value);
        } catch (error) {
          throw createSettingsValidationError(error.message);
        }
      },
    },
    music: {
      defaultValue: process.env.HARMONIARR_MUSIC ?? '/data/music',
      normalize: normalizePathSetting,
    },
    staging: {
      defaultValue: process.env.HARMONIARR_STAGING ?? '/data/staging',
      normalize: normalizePathSetting,
    },
    transcodeTemp: {
      defaultValue: process.env.HARMONIARR_TRANSCODE_TEMP ?? '/data/transcode-temp',
      normalize: normalizePathSetting,
    },
  },
  artwork: {
    fetchEnabled: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.fetchEnabled'),
    },
    providerOrder: {
      defaultValue: ['coverArtArchive'],
      normalize(value) {
        if (!Array.isArray(value) || value.length === 0) {
          throw createSettingsValidationError('artwork.providerOrder must be a non-empty array');
        }

        const normalized = value.map((entry) => {
          if (typeof entry !== 'string') {
            throw createSettingsValidationError('artwork.providerOrder entries must be strings');
          }

          return entry.trim();
        });

        if (normalized.some((entry) => entry.length === 0)) {
          throw createSettingsValidationError('artwork.providerOrder entries must be non-empty strings');
        }

        return normalized;
      },
    },
    captureEmbedded: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.captureEmbedded'),
    },
    captureFolderArtwork: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.captureFolderArtwork'),
    },
    derivativeFormat: {
      defaultValue: 'webp',
      normalize(value) {
        const normalized = String(value).trim().toLowerCase();
        if (!['webp', 'jpeg', 'png'].includes(normalized)) {
          throw createSettingsValidationError('artwork.derivativeFormat must be one of webp, jpeg, png');
        }

        return normalized;
      },
    },
    derivativeSizes: {
      defaultValue: [256, 512],
      normalize(value) {
        if (!Array.isArray(value) || value.length === 0) {
          throw createSettingsValidationError('artwork.derivativeSizes must be a non-empty array');
        }

        const normalized = value.map((entry) => normalizeIntegerSetting('artwork.derivativeSizes entry', entry, { min: 64, max: 4096 }));

        return [...new Set(normalized)].sort((left, right) => left - right);
      },
    },
    derivativeRetentionDays: {
      defaultValue: 30,
      normalize(value) {
        return normalizeIntegerSetting('artwork.derivativeRetentionDays', value, { min: 1, max: 3650 });
      },
    },
    unassignedRetentionDays: {
      defaultValue: 90,
      normalize(value) {
        return normalizeIntegerSetting('artwork.unassignedRetentionDays', value, { min: 1, max: 3650 });
      },
    },
  },
};

function normalizePathSetting(value) {
  if (typeof value !== 'string') {
    throw createSettingsValidationError('Path settings must be strings');
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/')) {
    throw createSettingsValidationError('Path settings must be absolute in-container paths');
  }

  return normalized;
}

function normalizeBooleanSetting(settingName) {
  return function normalizeBoolean(value) {
    if (typeof value !== 'boolean') {
      throw createSettingsValidationError(`${settingName} must be a boolean`);
    }

    return value;
  };
}

function normalizeIntegerSetting(settingName, value, { min, max } = {}) {
  if (!Number.isInteger(value)) {
    throw createSettingsValidationError(`${settingName} must be an integer`);
  }

  if (min !== undefined && value < min) {
    throw createSettingsValidationError(`${settingName} must be greater than or equal to ${min}`);
  }

  if (max !== undefined && value > max) {
    throw createSettingsValidationError(`${settingName} must be less than or equal to ${max}`);
  }

  return value;
}

export function getDefaultSettings() {
  return Object.fromEntries(
    Object.entries(settingDefinitions).map(([namespace, keys]) => [
      namespace,
      Object.fromEntries(
        Object.entries(keys).map(([settingKey, definition]) => [settingKey, definition.defaultValue]),
      ),
    ]),
  );
}

export function normalizeSettingsPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createSettingsValidationError('Settings payload must be an object');
  }

  const updates = [];
  for (const [namespace, namespaceValue] of Object.entries(input)) {
    if (!settingDefinitions[namespace]) {
      throw createSettingsValidationError(`Unknown settings namespace: ${namespace}`);
    }

    if (!namespaceValue || typeof namespaceValue !== 'object' || Array.isArray(namespaceValue)) {
      throw createSettingsValidationError(`Settings namespace ${namespace} must be an object`);
    }

    for (const [settingKey, rawValue] of Object.entries(namespaceValue)) {
      const definition = settingDefinitions[namespace][settingKey];
      if (!definition) {
        throw createSettingsValidationError(`Unknown setting key: ${namespace}.${settingKey}`);
      }

      updates.push({
        namespace,
        settingKey,
        value: definition.normalize(rawValue),
      });
    }
  }

  return updates;
}