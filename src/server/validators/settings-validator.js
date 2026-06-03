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
import {
  resolveCsrfProtectionMode,
  resolveHttpsEnforcementEnabled,
  resolveSecureCookiesEnabled,
  resolveStrictTransportSecurityEnabled,
} from '../deployment-security-service.js';
import {
  normalizeSlskdBaseUrl,
  normalizeSlskdRequestTimeoutMs,
  resolveSlskdBaseUrlDefault,
  resolveSlskdRequestTimeoutDefault,
} from '../integrations/slskd/slskd-config.js';
import { normalizeDownloadPathMappings } from '../paths/download-path-mapping-service.js';
import { normalizeUserMusicRoots } from '../paths/user-music-root-service.js';

function createSettingsValidationError(message) {
  return createApiError(400, 'validation_error', message);
}

const supportedArtworkProviders = new Set([
  'appleMusic',
  'coverArtArchive',
  'deezer',
  'discogs',
  'fanartTv',
  'spotify',
  'theAudioDb',
  'tidal',
]);

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
  security: {
    csrfProtectionMode: {
      defaultValue: resolveCsrfProtectionMode(),
      normalize(value) {
        try {
          return resolveCsrfProtectionMode(value);
        } catch (error) {
          throw createSettingsValidationError(error.message);
        }
      },
    },
    enforceHttps: {
      defaultValue: resolveHttpsEnforcementEnabled(),
      normalize: normalizeBooleanSetting('security.enforceHttps'),
    },
    secureCookies: {
      defaultValue: resolveSecureCookiesEnabled(),
      normalize: normalizeBooleanSetting('security.secureCookies'),
    },
    strictTransportSecurity: {
      defaultValue: resolveStrictTransportSecurityEnabled(),
      normalize: normalizeBooleanSetting('security.strictTransportSecurity'),
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
    userMusicRoots: {
      defaultValue: [],
      normalize(value) {
        try {
          return normalizeUserMusicRoots(value);
        } catch (error) {
          throw createSettingsValidationError(error.message);
        }
      },
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
    dailyQuotaLimit: {
      defaultValue: 1000,
      normalize(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) {
          throw createSettingsValidationError('artwork.dailyQuotaLimit must be a positive number');
        }
        return Math.floor(n);
      },
    },
    fetchEnabled: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.fetchEnabled'),
    },
    fanartTvEnabled: {
      defaultValue: false,
      normalize: normalizeBooleanSetting('artwork.fanartTvEnabled'),
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

        if (normalized.some((entry) => !supportedArtworkProviders.has(entry))) {
          throw createSettingsValidationError(`artwork.providerOrder entries must be one of ${[...supportedArtworkProviders].join(', ')}`);
        }

        return [...new Set(normalized)];
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
    maxOriginalFileSizeBytes: {
      defaultValue: 20 * 1024 * 1024,
      normalize(value) {
        return normalizeIntegerSetting('artwork.maxOriginalFileSizeBytes', value, { min: 1024 * 1024, max: 100 * 1024 * 1024 });
      },
    },
    maxOriginalDimensionPixels: {
      defaultValue: 4000,
      normalize(value) {
        return normalizeIntegerSetting('artwork.maxOriginalDimensionPixels', value, { min: 256, max: 8192 });
      },
    },
    derivativeCacheSizeMb: {
      defaultValue: 1024,
      normalize(value) {
        return normalizeIntegerSetting('artwork.derivativeCacheSizeMb', value, { min: 64, max: 16384 });
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
    refreshAfterMetadataRefresh: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.refreshAfterMetadataRefresh'),
    },
    refreshAfterImport: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('artwork.refreshAfterImport'),
    },
    refreshAfterLibraryScan: {
      defaultValue: false,
      normalize: normalizeBooleanSetting('artwork.refreshAfterLibraryScan'),
    },
    refetchMissingAutomatically: {
      defaultValue: false,
      normalize: normalizeBooleanSetting('artwork.refetchMissingAutomatically'),
    },
  },
  slskd: {
    baseUrl: {
      defaultValue: resolveSlskdBaseUrlDefault(),
      normalize(value) {
        try {
          return normalizeSlskdBaseUrl(value);
        } catch (error) {
          throw createSettingsValidationError(error.message);
        }
      },
    },
    requestTimeoutMs: {
      defaultValue: resolveSlskdRequestTimeoutDefault(),
      normalize(value) {
        try {
          return normalizeSlskdRequestTimeoutMs(value);
        } catch (error) {
          throw createSettingsValidationError(error.message);
        }
      },
    },
  },
  acquisition: {
    autoIgnoreEnabled: {
      defaultValue: false,
      normalize: normalizeBooleanSetting('acquisition.autoIgnoreEnabled'),
    },
    autoIgnoreCooldownHours: {
      defaultValue: 24,
      normalize(value) {
        return normalizeIntegerSetting('acquisition.autoIgnoreCooldownHours', value, { min: 0, max: 8760 });
      },
    },
  },
  providers: {
    spotifyClientId: {
      defaultValue: process.env.SPOTIFY_CLIENT_ID ?? '',
      normalize: normalizeStringAllowEmpty('providers.spotifyClientId'),
    },
    spotifyEnabled: {
      defaultValue: Boolean(process.env.SPOTIFY_CLIENT_ID),
      normalize: normalizeBooleanSetting('providers.spotifyEnabled'),
    },
    youtubeEnabled: {
      defaultValue: Boolean(process.env.YOUTUBE_API_KEY),
      normalize: normalizeBooleanSetting('providers.youtubeEnabled'),
    },
    youtubeClientId: {
      defaultValue: process.env.YOUTUBE_CLIENT_ID ?? '',
      normalize: normalizeStringAllowEmpty('providers.youtubeClientId'),
    },
    appleMusicTeamId: {
      defaultValue: process.env.APPLE_MUSIC_TEAM_ID ?? '',
      normalize: normalizeStringAllowEmpty('providers.appleMusicTeamId'),
    },
    appleMusicKeyId: {
      defaultValue: process.env.APPLE_MUSIC_KEY_ID ?? '',
      normalize: normalizeStringAllowEmpty('providers.appleMusicKeyId'),
    },
    appleMusicStorefront: {
      defaultValue: process.env.APPLE_MUSIC_STOREFRONT ?? 'us',
      normalize(value) {
        if (typeof value !== 'string') {
          throw createSettingsValidationError('providers.appleMusicStorefront must be a string');
        }

        const normalized = value.trim().toLowerCase();
        if (!normalized || normalized.length < 2 || normalized.length > 5) {
          throw createSettingsValidationError('providers.appleMusicStorefront must be a valid ISO 3166-1 alpha-2 storefront code');
        }

        return normalized;
      },
    },
    appleMusicEnabled: {
      defaultValue: Boolean(process.env.APPLE_MUSIC_TEAM_ID && process.env.APPLE_MUSIC_KEY_ID),
      normalize: normalizeBooleanSetting('providers.appleMusicEnabled'),
    },
    fanartTvEnabled: {
      defaultValue: false,
      normalize: normalizeBooleanSetting('providers.fanartTvEnabled'),
    },
    playlistExpansionPolicy: {
      defaultValue: 'bounded',
      normalize(value) {
        if (!['bounded', 'artist_discovery'].includes(value)) {
          throw createSettingsValidationError('providers.playlistExpansionPolicy must be one of bounded, artist_discovery');
        }

        return value;
      },
    },
    requestTimeoutMs: {
      defaultValue: 15000,
      normalize(value) {
        return normalizeIntegerSetting('providers.requestTimeoutMs', value, { min: 1000, max: 60000 });
      },
    },
  },
};

function normalizeStringAllowEmpty(settingName) {
  return function normalizeString(value) {
    if (typeof value !== 'string') {
      throw createSettingsValidationError(`${settingName} must be a string`);
    }

    return value.trim();
  };
}

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
