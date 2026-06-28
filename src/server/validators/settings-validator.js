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
import { DEFAULT_SCORING_WEIGHTS } from '../library/download-result-scoring.js';
import { DEFAULT_NAMING_TEMPLATES, validateTemplate } from '../library/library-naming-template-engine.js';
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
  retention: {
    operationRunMaxAgeDays: {
      defaultValue: 90,
      normalize(value) {
        return normalizeIntegerSetting('retention.operationRunMaxAgeDays', value, { min: 7, max: 3650 });
      },
    },
    operationRunRetainCountPerType: {
      defaultValue: 50,
      normalize(value) {
        return normalizeIntegerSetting('retention.operationRunRetainCountPerType', value, { min: 10, max: 1000 });
      },
    },
    outcomeEventMaxAgeDays: {
      defaultValue: 180,
      normalize(value) {
        return normalizeIntegerSetting('retention.outcomeEventMaxAgeDays', value, { min: 30, max: 3650 });
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
  fidelity: {
    spectralAuthenticMinCutoffHz: {
      defaultValue: 20000,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.spectralAuthenticMinCutoffHz', value, { min: 10000, max: 24000 });
      },
    },
    spectralSuspiciousMinCutoffHz: {
      defaultValue: 19000,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.spectralSuspiciousMinCutoffHz', value, { min: 8000, max: 24000 });
      },
    },
    spectralTranscodeMidCutoffHz: {
      defaultValue: 16000,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.spectralTranscodeMidCutoffHz', value, { min: 4000, max: 24000 });
      },
    },
    spectralMinSampleRateHz: {
      defaultValue: 44100,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.spectralMinSampleRateHz', value, { min: 8000, max: 192000 });
      },
    },
    trustWatchFailureCount: {
      defaultValue: 3,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.trustWatchFailureCount', value, { min: 1, max: 100 });
      },
    },
    trustWatchMaxSuccessRate: {
      defaultValue: 0.5,
      normalize(value) {
        return normalizeRateSetting('fidelity.trustWatchMaxSuccessRate', value);
      },
    },
    trustWatchEvidenceCount: {
      defaultValue: 3,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.trustWatchEvidenceCount', value, { min: 1, max: 1000 });
      },
    },
    trustHealthyEvidenceCount: {
      defaultValue: 5,
      normalize(value) {
        return normalizeIntegerSetting('fidelity.trustHealthyEvidenceCount', value, { min: 1, max: 1000 });
      },
    },
    trustHealthyMinSuccessRate: {
      defaultValue: 0.8,
      normalize(value) {
        return normalizeRateSetting('fidelity.trustHealthyMinSuccessRate', value);
      },
    },
  },
  library: {
    autoStartDownloadsAfterSelection: {
      defaultValue: true,
      normalize: normalizeBooleanSetting('library.autoStartDownloadsAfterSelection'),
    },
    discoveryCooldownHours: {
      defaultValue: 6,
      normalize(value) {
        return normalizeIntegerSetting('library.discoveryCooldownHours', value, { min: 1, max: 168 });
      },
    },
    discoveryFallbackCooldownHours: {
      defaultValue: 2,
      normalize(value) {
        return normalizeIntegerSetting('library.discoveryFallbackCooldownHours', value, { min: 1, max: 168 });
      },
    },
    discoveryBatchSize: {
      defaultValue: 5,
      normalize(value) {
        return normalizeIntegerSetting('library.discoveryBatchSize', value, { min: 1, max: 50 });
      },
    },
    maxSearchAttempts: {
      defaultValue: 3,
      normalize(value) {
        return normalizeIntegerSetting('library.maxSearchAttempts', value, { min: 1, max: 10 });
      },
    },
  },
  scoring: {
    weightFormatTier: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightFormatTier,
      normalize(value) {
        return normalizeRateSetting('scoring.weightFormatTier', value, { min: 0.01, max: 1.0 });
      },
    },
    weightCandidateTrackMatch: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightCandidateTrackMatch,
      normalize(value) {
        return normalizeRateSetting('scoring.weightCandidateTrackMatch', value, { min: 0.01, max: 1.0 });
      },
    },
    weightAudioDepth: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightAudioDepth,
      normalize(value) {
        return normalizeRateSetting('scoring.weightAudioDepth', value, { min: 0.01, max: 1.0 });
      },
    },
    weightDuration: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightDuration,
      normalize(value) {
        return normalizeRateSetting('scoring.weightDuration', value, { min: 0.01, max: 1.0 });
      },
    },
    weightFormatConsistency: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightFormatConsistency,
      normalize(value) {
        return normalizeRateSetting('scoring.weightFormatConsistency', value, { min: 0.01, max: 1.0 });
      },
    },
    weightTrackCount: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightTrackCount,
      normalize(value) {
        return normalizeRateSetting('scoring.weightTrackCount', value, { min: 0.01, max: 1.0 });
      },
    },
    weightPeerDelivery: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightPeerDelivery,
      normalize(value) {
        return normalizeRateSetting('scoring.weightPeerDelivery', value, { min: 0.01, max: 1.0 });
      },
    },
    weightUploaderReputation: {
      defaultValue: DEFAULT_SCORING_WEIGHTS.weightUploaderReputation,
      normalize(value) {
        return normalizeRateSetting('scoring.weightUploaderReputation', value, { min: 0.01, max: 1.0 });
      },
    },
  },
  naming: {
    artistFolderFormat: {
      defaultValue: DEFAULT_NAMING_TEMPLATES.artistFolderFormat,
      normalize(value) {
        return normalizeTemplateSetting('naming.artistFolderFormat', value);
      },
    },
    albumFolderFormat: {
      defaultValue: DEFAULT_NAMING_TEMPLATES.albumFolderFormat,
      normalize(value) {
        return normalizeTemplateSetting('naming.albumFolderFormat', value);
      },
    },
    trackFilenameFormat: {
      defaultValue: DEFAULT_NAMING_TEMPLATES.trackFilenameFormat,
      normalize(value) {
        return normalizeTemplateSetting('naming.trackFilenameFormat', value);
      },
    },
    multiDiscTrackFilenameFormat: {
      defaultValue: DEFAULT_NAMING_TEMPLATES.multiDiscTrackFilenameFormat,
      normalize(value) {
        return normalizeTemplateSetting('naming.multiDiscTrackFilenameFormat', value);
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

function normalizeRateSetting(settingName, value, { min = 0, max = 1 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createSettingsValidationError(`${settingName} must be a number`);
  }

  if (value < min || value > max) {
    throw createSettingsValidationError(`${settingName} must be between ${min} and ${max}`);
  }

  return value;
}

function normalizeTemplateSetting(settingName, value) {
  const result = validateTemplate(value);
  if (!result.valid) {
    throw createSettingsValidationError(`${settingName}: ${result.reason}`);
  }

  return typeof value === 'string' ? value.trim() : value;
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

const SCORING_WEIGHT_KEYS = [
  'weightFormatTier',
  'weightCandidateTrackMatch',
  'weightAudioDepth',
  'weightDuration',
  'weightFormatConsistency',
  'weightTrackCount',
  'weightPeerDelivery',
  'weightUploaderReputation',
];

const namespaceValidators = {
  scoring(namespaceUpdates) {
    const keys = namespaceUpdates.map((u) => u.settingKey);
    if (keys.length === SCORING_WEIGHT_KEYS.length
        && SCORING_WEIGHT_KEYS.every((k) => keys.includes(k))) {
      const sum = namespaceUpdates.reduce((s, u) => s + u.value, 0);
      if (Math.abs(sum - 1.0) >= 0.0001) {
        throw createSettingsValidationError('scoring weights must sum to 1.0');
      }
    }
  },
};

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

  const updatesByNamespace = new Map();
  for (const update of updates) {
    const existing = updatesByNamespace.get(update.namespace) ?? [];
    existing.push(update);
    updatesByNamespace.set(update.namespace, existing);
  }
  for (const [ns, nsUpdates] of updatesByNamespace) {
    namespaceValidators[ns]?.(nsUpdates);
  }

  return updates;
}
