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

import { recordAuditEvent } from './audit.js';
import { getPool } from './database.js';
import { createPathValidationService } from './paths/path-validation-service.js';
import { normalizeUserMusicRoots } from './paths/user-music-root-service.js';
import { loadSettings, persistSettings } from './settings.js';
import { createSlskdConfigService } from './slskd/slskd-config-service.js';
import { createProviderCredentialsService } from './integrations/providers/provider-credentials-service.js';
import { createPlexOwnerLinkService } from './integrations/plex/plex-owner-link-service.js';
import { createSpotifyOAuthService } from './integrations/spotify/spotify-oauth-service.js';
import { createYouTubeOAuthService } from './integrations/youtube/youtube-oauth-service.js';
import { validateDownloadPathMappingsAgainstSettings } from './paths/download-path-mapping-service.js';
import { normalizeSettingsPatch } from './validators/settings-validator.js';

function applySettingsUpdates(settings, updates) {
  const nextSettings = structuredClone(settings);

  for (const update of updates) {
    nextSettings[update.namespace][update.settingKey] = update.value;
  }

  return nextSettings;
}

export function createSettingsService({
  deploymentSecurityService = null,
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  pathValidationService = createPathValidationService(),
  plexOwnerLinkService = createPlexOwnerLinkService({ loadSettingsFn }),
  persistSettingsFn = persistSettings,
  providerCredentialsService = createProviderCredentialsService(),
  recordAuditEventFn = recordAuditEvent,
  slskdConfigService = createSlskdConfigService({ loadSettingsFn }),
  spotifyOAuthService = createSpotifyOAuthService({ loadSettingsFn }),
  youtubeOAuthService = createYouTubeOAuthService({ loadSettingsFn, providerCredentialsService }),
  validateDownloadMappingsFn = validateDownloadPathMappingsAgainstSettings,
} = {}) {
  async function buildPayloadForSettings(settings, queryable) {
    deploymentSecurityService?.applySettings(settings);

    return {
      secretStatus: {
        providers: {
          ...(await providerCredentialsService.buildSecretStatus(queryable)),
          plex: await plexOwnerLinkService.buildStatus(queryable),
          spotifyOAuth: await spotifyOAuthService.buildStatus(queryable),
          youtubeOAuth: await youtubeOAuthService.buildStatus(queryable),
        },
        slskd: await slskdConfigService.buildSecretStatus(queryable),
      },
      settings,
      pathValidation: await pathValidationService.validateSettingsPaths(settings),
    };
  }

  async function buildSettingsPayload() {
    const settings = await loadSettingsFn();
    return buildPayloadForSettings(settings, getPoolFn());
  }

  async function updateSettings({ patch, actorUserId, requestMetadata }) {
    const providerSecretMutation = providerCredentialsService.buildSecretMutation(patch);
    const slskdSecretMutation = slskdConfigService.buildSecretMutation(providerSecretMutation.sanitizedPatch ?? patch);
    const updates = normalizeSettingsPatch(slskdSecretMutation.sanitizedPatch ?? providerSecretMutation.sanitizedPatch ?? patch);
    const currentSettings = await loadSettingsFn();
    const nextSettings = applySettingsUpdates(currentSettings, updates);

    validateDownloadMappingsFn({
      downloadMappings: nextSettings.paths?.downloadMappings,
      downloadsRoot: nextSettings.paths?.downloads,
    });
    normalizeUserMusicRoots(nextSettings.paths?.userMusicRoots ?? []);

    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      if (updates.length > 0) {
        await persistSettingsFn(updates, actorUserId, client);
      }
      await providerSecretMutation.apply(client);
      await slskdSecretMutation.apply(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    deploymentSecurityService?.applySettings(nextSettings);

    await recordAuditEventFn({
      actorUserId,
      actorType: 'user',
      eventType: 'settings_updated',
      summary: 'Application settings updated',
      details: {
        updatedKeys: [
          ...updates.map((update) => `${update.namespace}.${update.settingKey}`),
          ...providerSecretMutation.updatedKeys,
          ...slskdSecretMutation.updatedKeys,
        ],
      },
      entityType: 'settings',
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return {
      ...(await buildSettingsPayload()),
      updates,
    };
  }

  return {
    buildSettingsPayload,
    updateSettings,
  };
}
