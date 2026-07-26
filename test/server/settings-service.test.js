import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettingsService } from '../../src/server/settings-service.js';

function createPool(t) {
  const client = {
    query: t.mock.fn(async () => ({ rows: [] })),
    release: t.mock.fn(),
  };

  return {
    client,
    pool: {
      query: t.mock.fn(async () => ({ rows: [] })),
      connect: t.mock.fn(async () => client),
    },
  };
}

function createNoopProviderCredentialsService() {
  const emptyProviderStatus = {
    spotify: { clientSecretConfigured: false, clientSecretSource: null, clientSecretUpdatedAt: null },
    youtube: {
      apiKeyConfigured: false,
      apiKeySource: null,
      apiKeyUpdatedAt: null,
      clientSecretConfigured: false,
      clientSecretSource: null,
      clientSecretUpdatedAt: null,
    },
    appleMusic: { privateKeyConfigured: false, privateKeySource: null, privateKeyUpdatedAt: null },
  };

  return {
    buildSecretMutation: () => ({ sanitizedPatch: null, updatedKeys: [], apply: async () => {} }),
    buildSecretStatus: async () => emptyProviderStatus,
    resolveAppleMusicPrivateKey: async () => null,
    resolveSpotifyClientSecret: async () => null,
    resolveYoutubeApiKey: async () => null,
    resolveYoutubeClientSecret: async () => null,
  };
}

function createBaseSettings() {
  return {
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: {
      baseUrl: '',
      logLevel: 'info',
    },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    artwork: {
      captureEmbedded: true,
      captureFolderArtwork: true,
      derivativeCacheSizeMb: 1024,
      derivativeFormat: 'webp',
      derivativeRetentionDays: 30,
      derivativeSizes: [256, 512],
      fetchEnabled: true,
      maxOriginalDimensionPixels: 4000,
      maxOriginalFileSizeBytes: 20 * 1024 * 1024,
      providerOrder: ['coverArtArchive'],
      refetchMissingAutomatically: false,
      refreshAfterImport: true,
      refreshAfterLibraryScan: false,
      refreshAfterMetadataRefresh: true,
      unassignedRetentionDays: 90,
    },
    slskd: {
      baseUrl: 'http://slskd:5030',
      requestTimeoutMs: 10000,
    },
  };
}

test('createSettingsService rejects malformed settings patches with validation metadata', async () => {
  const settingsService = createSettingsService();

  await assert.rejects(
    () => settingsService.updateSettings({
      patch: { invalidNamespace: { any: 'value' } },
      actorUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'Unknown settings namespace: invalidNamespace',
  );
});

test('createSettingsService rejects download mappings outside the configured downloads root before persisting', async (t) => {
  const loadSettingsFn = t.mock.fn(async () => createBaseSettings());
  const persistSettingsFn = t.mock.fn();
  const settingsService = createSettingsService({
    loadSettingsFn,
    persistSettingsFn,
  });

  await assert.rejects(
    () => settingsService.updateSettings({
      patch: {
        paths: {
          downloadMappings: [{
            slskdPrefix: '/downloads/completed',
            harmoniarrPrefix: '/outside/downloads',
          }],
        },
      },
      actorUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    }),
    (error) => error?.message === 'paths.downloadMappings[0].harmoniarrPrefix must stay within paths.downloads',
  );

  assert.equal(persistSettingsFn.mock.callCount(), 0);
});

test('createSettingsService rejects invalid per-user music root mappings before persisting', async (t) => {
  const loadSettingsFn = t.mock.fn(async () => createBaseSettings());
  const persistSettingsFn = t.mock.fn();
  const settingsService = createSettingsService({
    loadSettingsFn,
    persistSettingsFn,
  });

  await assert.rejects(
    () => settingsService.updateSettings({
      patch: {
        paths: {
          userMusicRoots: [{
            relativeRoot: '../escape',
            userId: 'user-1',
          }],
        },
      },
      actorUserId: 'user-1',
      requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    }),
    (error) => error?.message === 'paths.userMusicRoots[0].relativeRoot must not contain dot traversal segments',
  );

  assert.equal(persistSettingsFn.mock.callCount(), 0);
});

test('createSettingsService includes shared path validation in read and update payloads', async (t) => {
  const { client, pool } = createPool(t);
  const settings = createBaseSettings();
  const persistedSettings = {
    ...settings,
    system: {
      ...settings.system,
      logLevel: 'debug',
    },
  };
  const loadSettingsFn = t.mock.fn(async () => {
    return loadSettingsFn.mock.callCount() > 1 ? persistedSettings : settings;
  });
  const persistSettingsFn = t.mock.fn(async () => persistedSettings);
  const pathValidationService = {
    validateSettingsPaths: t.mock.fn(async (activeSettings) => ({
      checkedAt: '2026-04-30T20:00:00.000Z',
      summary: {
        status: 'healthy',
        message: `Validated ${activeSettings.system.logLevel}`,
      },
      roots: [],
      downloadMappings: [],
      notes: {
        remoteSlskdValidation: 'local-only',
      },
    })),
  };
  const deploymentSecurityService = {
    applySettings: t.mock.fn(() => ({
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    })),
  };
  const settingsService = createSettingsService({
    deploymentSecurityService,
    getPoolFn: () => pool,
    loadSettingsFn,
    pathValidationService,
    persistSettingsFn,
    recordAuditEventFn: t.mock.fn(async () => {}),
    providerCredentialsService: createNoopProviderCredentialsService(),
    slskdConfigService: {
      buildSecretMutation: () => ({
        sanitizedPatch: { system: { logLevel: 'debug' } },
        updatedKeys: [],
        apply: async () => {},
      }),
      buildSecretStatus: t.mock.fn(async () => ({
        apiKeyConfigured: true,
        apiKeySource: 'environment',
        apiKeyUpdatedAt: null,
      })),
    },
  });

  const readPayload = await settingsService.buildSettingsPayload();
  const updatePayload = await settingsService.updateSettings({
    patch: { system: { logLevel: 'debug' } },
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(pool.connect.mock.callCount(), 1);
  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'COMMIT']);
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(pathValidationService.validateSettingsPaths.mock.callCount(), 2);
  assert.equal(deploymentSecurityService.applySettings.mock.callCount(), 3);
  assert.equal(readPayload.secretStatus.slskd.apiKeySource, 'environment');
  assert.equal(updatePayload.secretStatus.slskd.apiKeyConfigured, true);
  assert.equal(readPayload.pathValidation.summary.message, 'Validated info');
  assert.equal(updatePayload.pathValidation.summary.message, 'Validated debug');
});

test('createSettingsService schedules bounded Music Queue recovery only after changed folder setup validates', async (t) => {
  const { pool } = createPool(t);
  const settings = createBaseSettings();
  const persistedSettings = {
    ...settings,
    paths: {
      ...settings.paths,
      downloads: '/data/downloads-ready',
    },
  };
  const loadSettingsFn = t.mock.fn(async () => (
    loadSettingsFn.mock.callCount() > 1 ? persistedSettings : settings
  ));
  const automaticDownloadFolderReadinessService = {
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({ ready: true })),
  };
  const onAutomaticDownloadFoldersReady = t.mock.fn(async () => ({
    dispatchAlreadyActive: false,
    dispatchDeferred: false,
    releasedCount: 2,
    runStarted: true,
  }));
  const settingsService = createSettingsService({
    automaticDownloadFolderReadinessService,
    getPoolFn: () => pool,
    loadSettingsFn,
    onAutomaticDownloadFoldersReady,
    pathValidationService: {
      validateSettingsPaths: async () => ({ summary: { message: 'Folders ready', status: 'healthy' } }),
    },
    persistSettingsFn: async () => persistedSettings,
    providerCredentialsService: createNoopProviderCredentialsService(),
    recordAuditEventFn: t.mock.fn(async () => {}),
    slskdConfigService: {
      buildSecretMutation: () => ({ sanitizedPatch: null, updatedKeys: [], apply: async () => {} }),
      buildSecretStatus: async () => ({ apiKeyConfigured: false, apiKeySource: null, apiKeyUpdatedAt: null }),
    },
  });

  const result = await settingsService.updateSettings({
    patch: { paths: { downloads: '/data/downloads-ready' } },
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.20', userAgent: 'FolderSetupTest/1.0' },
  });

  assert.deepEqual(automaticDownloadFolderReadinessService.getAutomaticDownloadFolderReadiness.mock.calls[0].arguments[0], {
    settings: persistedSettings,
  });
  assert.deepEqual(onAutomaticDownloadFoldersReady.mock.calls[0].arguments[0], {
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.20', userAgent: 'FolderSetupTest/1.0' },
    settings: persistedSettings,
  });
  assert.equal(result.musicQueueRecovery.releasedCount, 2);
  assert.equal(result.musicQueueRecovery.runStarted, true);
});

test('createSettingsService leaves Music Queue recovery untouched when changed folder setup is not ready', async (t) => {
  const { pool } = createPool(t);
  const settings = createBaseSettings();
  const automaticDownloadFolderReadinessService = {
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({
      ready: false,
      reason: 'download_folder_unavailable',
    })),
  };
  const onAutomaticDownloadFoldersReady = t.mock.fn(async () => ({}));
  const settingsService = createSettingsService({
    automaticDownloadFolderReadinessService,
    getPoolFn: () => pool,
    loadSettingsFn: async () => settings,
    onAutomaticDownloadFoldersReady,
    pathValidationService: {
      validateSettingsPaths: async () => ({ summary: { message: 'Unavailable', status: 'degraded' } }),
    },
    persistSettingsFn: async () => settings,
    providerCredentialsService: createNoopProviderCredentialsService(),
    recordAuditEventFn: t.mock.fn(async () => {}),
    slskdConfigService: {
      buildSecretMutation: () => ({ sanitizedPatch: null, updatedKeys: [], apply: async () => {} }),
      buildSecretStatus: async () => ({ apiKeyConfigured: false, apiKeySource: null, apiKeyUpdatedAt: null }),
    },
  });

  const result = await settingsService.updateSettings({
    patch: { paths: { downloads: '/data/downloads' } },
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.20', userAgent: 'FolderSetupTest/1.0' },
  });

  assert.equal(automaticDownloadFolderReadinessService.getAutomaticDownloadFolderReadiness.mock.callCount(), 1);
  assert.equal(onAutomaticDownloadFoldersReady.mock.callCount(), 0);
  assert.equal(result.musicQueueRecovery, null);
});

test('createSettingsService applies slskd secret mutations and records them in audit metadata', async (t) => {
  const { client, pool } = createPool(t);
  const settings = createBaseSettings();
  const loadSettingsFn = t.mock.fn(async () => settings);
  const persistSettingsFn = t.mock.fn(async () => settings);
  const applySecretMutation = t.mock.fn(async () => {});
  const recordAuditEventFn = t.mock.fn(async () => {});
  const settingsService = createSettingsService({
    getPoolFn: () => pool,
    loadSettingsFn,
    persistSettingsFn,
    providerCredentialsService: createNoopProviderCredentialsService(),
    recordAuditEventFn,
    slskdConfigService: {
      buildSecretMutation: t.mock.fn(() => ({
        sanitizedPatch: { slskd: { baseUrl: 'http://slskd.internal:5030' } },
        updatedKeys: ['slskd.apiKey'],
        apply: applySecretMutation,
      })),
      buildSecretStatus: t.mock.fn(async () => ({
        apiKeyConfigured: true,
        apiKeySource: 'stored',
        apiKeyUpdatedAt: '2026-05-01T12:00:00.000Z',
      })),
    },
  });

  await settingsService.updateSettings({
    patch: {
      slskd: {
        apiKey: 'secret-api-key',
        baseUrl: 'http://slskd.internal:5030',
      },
    },
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(pool.connect.mock.callCount(), 1);
  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'COMMIT']);
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(applySecretMutation.mock.callCount(), 1);
  assert.equal(persistSettingsFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0].details.updatedKeys, ['slskd.baseUrl', 'slskd.apiKey']);
});

test('createSettingsService persists artwork settings updates through the shared allowlist', async (t) => {
  const { client, pool } = createPool(t);
  const settings = createBaseSettings();
  const loadSettingsFn = t.mock.fn(async () => settings);
  const persistSettingsFn = t.mock.fn(async () => settings);
  const settingsService = createSettingsService({
    getPoolFn: () => pool,
    loadSettingsFn,
    persistSettingsFn,
    recordAuditEventFn: t.mock.fn(async () => {}),
    slskdConfigService: {
      buildSecretMutation: () => ({
        sanitizedPatch: {
          artwork: {
            derivativeCacheSizeMb: 2048,
            maxOriginalDimensionPixels: 4096,
            maxOriginalFileSizeBytes: 33554432,
            providerOrder: ['coverArtArchive', 'discogs'],
            refetchMissingAutomatically: true,
            refreshAfterLibraryScan: true,
          },
        },
        updatedKeys: [],
        apply: async () => {},
      }),
      buildSecretStatus: t.mock.fn(async () => ({
        apiKeyConfigured: false,
        apiKeySource: null,
        apiKeyUpdatedAt: null,
      })),
    },
  });

  const result = await settingsService.updateSettings({
    patch: {
      artwork: {
        derivativeCacheSizeMb: 2048,
        maxOriginalDimensionPixels: 4096,
        maxOriginalFileSizeBytes: 33554432,
        providerOrder: ['coverArtArchive', 'discogs'],
        refetchMissingAutomatically: true,
        refreshAfterLibraryScan: true,
      },
    },
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(pool.connect.mock.callCount(), 1);
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(persistSettingsFn.mock.callCount(), 1);
  assert.deepEqual(persistSettingsFn.mock.calls[0].arguments[0], [{
    namespace: 'artwork',
    settingKey: 'derivativeCacheSizeMb',
    value: 2048,
  }, {
    namespace: 'artwork',
    settingKey: 'maxOriginalDimensionPixels',
    value: 4096,
  }, {
    namespace: 'artwork',
    settingKey: 'maxOriginalFileSizeBytes',
    value: 33554432,
  }, {
    namespace: 'artwork',
    settingKey: 'providerOrder',
    value: ['coverArtArchive', 'discogs'],
  }, {
    namespace: 'artwork',
    settingKey: 'refetchMissingAutomatically',
    value: true,
  }, {
    namespace: 'artwork',
    settingKey: 'refreshAfterLibraryScan',
    value: true,
  }]);
  assert.deepEqual(result.updates, persistSettingsFn.mock.calls[0].arguments[0]);
});

