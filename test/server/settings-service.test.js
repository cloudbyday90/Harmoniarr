import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettingsService } from '../../src/server/settings-service.js';

function createBaseSettings() {
  return {
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
    },
    artwork: {
      captureEmbedded: true,
      captureFolderArtwork: true,
      derivativeFormat: 'webp',
      derivativeRetentionDays: 30,
      derivativeSizes: [256, 512],
      fetchEnabled: true,
      providerOrder: ['coverArtArchive'],
      unassignedRetentionDays: 90,
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

test('createSettingsService includes shared path validation in read and update payloads', async (t) => {
  const settings = createBaseSettings();
  const loadSettingsFn = t.mock.fn(async () => settings);
  const persistSettingsFn = t.mock.fn(async () => ({
    ...settings,
    system: {
      ...settings.system,
      logLevel: 'debug',
    },
  }));
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
  const settingsService = createSettingsService({
    loadSettingsFn,
    pathValidationService,
    persistSettingsFn,
    recordAuditEventFn: t.mock.fn(async () => {}),
  });

  const readPayload = await settingsService.buildSettingsPayload();
  const updatePayload = await settingsService.updateSettings({
    patch: { system: { logLevel: 'debug' } },
    actorUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(pathValidationService.validateSettingsPaths.mock.callCount(), 2);
  assert.equal(readPayload.pathValidation.summary.message, 'Validated info');
  assert.equal(updatePayload.pathValidation.summary.message, 'Validated debug');
});