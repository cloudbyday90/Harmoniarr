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

import { posix as path } from 'node:path';
import { createSettingsService } from '../settings-service.js';

function normalizeAppDataPath(value) {
  if (typeof value !== 'string') {
    throw new Error('appDataPath must be a string');
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/')) {
    throw new Error('appDataPath must be an absolute in-container path');
  }

  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function resolveArtworkStoragePaths({
  appDataPath = process.env.HARMONIARR_APPDATA ?? '/app/data',
} = {}) {
  const normalizedAppDataPath = normalizeAppDataPath(appDataPath);
  const root = path.join(normalizedAppDataPath, 'artwork');

  return {
    derivativesPath: path.join(root, 'derivatives'),
    extractedPath: path.join(root, 'extracted'),
    originalsPath: path.join(root, 'originals'),
    root,
    tempPath: path.join(root, 'tmp'),
  };
}

export function buildArtworkDerivativeProfiles(artworkSettings = {}) {
  const format = artworkSettings.derivativeFormat ?? 'webp';
  const sizes = Array.isArray(artworkSettings.derivativeSizes)
    ? artworkSettings.derivativeSizes
    : [];

  return sizes.map((size) => ({
    format,
    key: `${size}-${format}`,
    size,
  }));
}

export function buildArtworkRuntimePolicy({
  appDataPath = process.env.HARMONIARR_APPDATA ?? '/app/data',
  settingsPayload = {},
} = {}) {
  const artworkSettings = settingsPayload.settings?.artwork ?? {};

  return {
    automation: {
      refreshAfterImport: artworkSettings.refreshAfterImport ?? true,
      refreshAfterLibraryScan: artworkSettings.refreshAfterLibraryScan ?? false,
      refreshAfterMetadataRefresh: artworkSettings.refreshAfterMetadataRefresh ?? true,
    },
    capture: {
      embeddedArtworkEnabled: artworkSettings.captureEmbedded ?? true,
      folderArtworkEnabled: artworkSettings.captureFolderArtwork ?? true,
    },
    cleanup: {
      derivativeCacheSizeMb: artworkSettings.derivativeCacheSizeMb ?? 1024,
      derivativeRetentionDays: artworkSettings.derivativeRetentionDays ?? 30,
      unassignedRetentionDays: artworkSettings.unassignedRetentionDays ?? 90,
    },
    derivatives: {
      format: artworkSettings.derivativeFormat ?? 'webp',
      profiles: buildArtworkDerivativeProfiles(artworkSettings),
    },
    fetch: {
      dailyQuotaLimit: artworkSettings.dailyQuotaLimit ?? 1000,
      enabled: artworkSettings.fetchEnabled ?? true,
      providerOrder: artworkSettings.providerOrder ?? ['coverArtArchive'],
      refetchMissingAutomatically: artworkSettings.refetchMissingAutomatically ?? false,
    },
    limits: {
      maxOriginalDimensionPixels: artworkSettings.maxOriginalDimensionPixels ?? 4000,
      maxOriginalFileSizeBytes: artworkSettings.maxOriginalFileSizeBytes ?? 20 * 1024 * 1024,
    },
    storage: resolveArtworkStoragePaths({ appDataPath }),
  };
}

export function createArtworkPolicyService({
  appDataPath = process.env.HARMONIARR_APPDATA ?? '/app/data',
  settingsService = createSettingsService(),
} = {}) {
  function buildArtworkOverviewFromSettingsPayload(settingsPayload) {
    const policy = buildArtworkRuntimePolicy({ appDataPath, settingsPayload });

    return {
      automation: policy.automation,
      capture: policy.capture,
      cleanup: policy.cleanup,
      derivatives: {
        format: policy.derivatives.format,
        profiles: policy.derivatives.profiles,
      },
      fetch: policy.fetch,
      limits: policy.limits,
      storage: policy.storage,
    };
  }

  async function buildArtworkOverview() {
    const settingsPayload = await settingsService.buildSettingsPayload();
    return buildArtworkOverviewFromSettingsPayload(settingsPayload);
  }

  async function getArtworkRuntimePolicy() {
    const settingsPayload = await settingsService.buildSettingsPayload();
    return buildArtworkRuntimePolicy({ appDataPath, settingsPayload });
  }

  return {
    buildArtworkOverview,
    buildArtworkOverviewFromSettingsPayload,
    getArtworkRuntimePolicy,
  };
}