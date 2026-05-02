import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArtworkRuntimePolicy,
  createArtworkPolicyService,
  resolveArtworkStoragePaths,
} from '../../src/server/artwork/artwork-policy-service.js';

test('resolveArtworkStoragePaths derives the documented artwork subtree from app data', () => {
  assert.deepEqual(resolveArtworkStoragePaths({ appDataPath: '/srv/harmoniarr/' }), {
    derivativesPath: '/srv/harmoniarr/artwork/derivatives',
    extractedPath: '/srv/harmoniarr/artwork/extracted',
    originalsPath: '/srv/harmoniarr/artwork/originals',
    root: '/srv/harmoniarr/artwork',
    tempPath: '/srv/harmoniarr/artwork/tmp',
  });
});

test('buildArtworkRuntimePolicy converts settings into shared worker-facing policy', () => {
  const policy = buildArtworkRuntimePolicy({
    appDataPath: '/srv/harmoniarr',
    settingsPayload: {
      settings: {
        artwork: {
          captureEmbedded: false,
          captureFolderArtwork: true,
          derivativeCacheSizeMb: 2048,
          derivativeFormat: 'jpeg',
          derivativeRetentionDays: 14,
          derivativeSizes: [320, 640],
          fetchEnabled: true,
          maxOriginalDimensionPixels: 4096,
          maxOriginalFileSizeBytes: 33554432,
          providerOrder: ['coverArtArchive', 'discogs'],
          refetchMissingAutomatically: true,
          refreshAfterImport: false,
          refreshAfterLibraryScan: true,
          refreshAfterMetadataRefresh: true,
          unassignedRetentionDays: 120,
        },
      },
    },
  });

  assert.deepEqual(policy, {
    automation: {
      refreshAfterImport: false,
      refreshAfterLibraryScan: true,
      refreshAfterMetadataRefresh: true,
    },
    capture: {
      embeddedArtworkEnabled: false,
      folderArtworkEnabled: true,
    },
    cleanup: {
      derivativeCacheSizeMb: 2048,
      derivativeRetentionDays: 14,
      unassignedRetentionDays: 120,
    },
    derivatives: {
      format: 'jpeg',
      profiles: [
        { format: 'jpeg', key: '320-jpeg', size: 320 },
        { format: 'jpeg', key: '640-jpeg', size: 640 },
      ],
    },
    fetch: {
      enabled: true,
      providerOrder: ['coverArtArchive', 'discogs'],
      refetchMissingAutomatically: true,
    },
    limits: {
      maxOriginalDimensionPixels: 4096,
      maxOriginalFileSizeBytes: 33554432,
    },
    storage: {
      derivativesPath: '/srv/harmoniarr/artwork/derivatives',
      extractedPath: '/srv/harmoniarr/artwork/extracted',
      originalsPath: '/srv/harmoniarr/artwork/originals',
      root: '/srv/harmoniarr/artwork',
      tempPath: '/srv/harmoniarr/artwork/tmp',
    },
  });
});

test('createArtworkPolicyService reuses the shared settings payload for overview generation', async (t) => {
  const settingsPayload = {
    settings: {
      artwork: {
        captureEmbedded: true,
        captureFolderArtwork: true,
        derivativeCacheSizeMb: 1024,
        derivativeFormat: 'webp',
        derivativeRetentionDays: 30,
        derivativeSizes: [256, 512],
        fetchEnabled: true,
        maxOriginalDimensionPixels: 4000,
        maxOriginalFileSizeBytes: 20971520,
        providerOrder: ['coverArtArchive'],
        refetchMissingAutomatically: false,
        refreshAfterImport: true,
        refreshAfterLibraryScan: false,
        refreshAfterMetadataRefresh: true,
        unassignedRetentionDays: 90,
      },
    },
  };
  const settingsService = {
    buildSettingsPayload: t.mock.fn(async () => settingsPayload),
  };
  const artworkPolicyService = createArtworkPolicyService({
    appDataPath: '/app/data',
    settingsService,
  });

  const overview = await artworkPolicyService.buildArtworkOverview();

  assert.equal(settingsService.buildSettingsPayload.mock.callCount(), 1);
  assert.deepEqual(overview, {
    automation: {
      refreshAfterImport: true,
      refreshAfterLibraryScan: false,
      refreshAfterMetadataRefresh: true,
    },
    capture: {
      embeddedArtworkEnabled: true,
      folderArtworkEnabled: true,
    },
    cleanup: {
      derivativeCacheSizeMb: 1024,
      derivativeRetentionDays: 30,
      unassignedRetentionDays: 90,
    },
    derivatives: {
      format: 'webp',
      profiles: [
        { format: 'webp', key: '256-webp', size: 256 },
        { format: 'webp', key: '512-webp', size: 512 },
      ],
    },
    fetch: {
      enabled: true,
      providerOrder: ['coverArtArchive'],
      refetchMissingAutomatically: false,
    },
    limits: {
      maxOriginalDimensionPixels: 4000,
      maxOriginalFileSizeBytes: 20971520,
    },
    storage: {
      derivativesPath: '/app/data/artwork/derivatives',
      extractedPath: '/app/data/artwork/extracted',
      originalsPath: '/app/data/artwork/originals',
      root: '/app/data/artwork',
      tempPath: '/app/data/artwork/tmp',
    },
  });
});