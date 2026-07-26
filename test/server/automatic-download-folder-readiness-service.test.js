import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATIC_DOWNLOAD_SETUP_REASONS,
  createAutomaticDownloadFolderReadinessService,
} from '../../src/server/paths/automatic-download-folder-readiness-service.js';

function createSettings(overrides = {}) {
  return {
    paths: {
      downloadMappings: [{
        harmoniarrPrefix: '/data/downloads/complete/music',
        slskdPrefix: '/downloads/Complete/Music',
      }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
    },
    ...overrides,
  };
}

function createHealthyValidation() {
  return {
    downloadMappings: [{ status: 'healthy' }],
    roots: [
      { key: 'downloads', status: 'healthy' },
      { key: 'staging', status: 'healthy' },
      { key: 'music', status: 'healthy' },
    ],
  };
}

test('automatic download folder readiness accepts validated required folders and a translated source mapping', async () => {
  const service = createAutomaticDownloadFolderReadinessService({
    validateSettingsPaths: async () => createHealthyValidation(),
  });

  const result = await service.getAutomaticDownloadFolderReadiness({ settings: createSettings() });

  assert.deepEqual(result, { ready: true });
});

test('automatic download folder readiness requires explicit folder configuration before automatic downloads', async (t) => {
  const validateSettingsPaths = t.mock.fn(async () => createHealthyValidation());
  const service = createAutomaticDownloadFolderReadinessService({ validateSettingsPaths });

  const result = await service.getAutomaticDownloadFolderReadiness({
    settings: createSettings({
      paths: {
        ...createSettings().paths,
        downloadMappings: [],
      },
    }),
  });

  assert.equal(result.ready, false);
  assert.equal(result.reason, AUTOMATIC_DOWNLOAD_SETUP_REASONS.MISSING_DOWNLOAD_FOLDER);
  assert.match(result.message, /Finish folder setup/);
  assert.equal(validateSettingsPaths.mock.callCount(), 0);
});

test('automatic download folder readiness blocks unavailable folders without exposing host details', async () => {
  const service = createAutomaticDownloadFolderReadinessService({
    validateSettingsPaths: async () => ({
      ...createHealthyValidation(),
      roots: [
        { key: 'downloads', status: 'healthy' },
        { key: 'staging', status: 'unavailable', message: 'EACCES at /private/staging' },
        { key: 'music', status: 'healthy' },
      ],
    }),
  });

  const result = await service.getAutomaticDownloadFolderReadiness({ settings: createSettings() });

  assert.equal(result.ready, false);
  assert.equal(result.reason, AUTOMATIC_DOWNLOAD_SETUP_REASONS.DOWNLOAD_FOLDER_UNAVAILABLE);
  assert.doesNotMatch(JSON.stringify(result), /private|EACCES/i);
});

test('automatic download folder readiness requires a reachable explicit source mapping', async () => {
  const service = createAutomaticDownloadFolderReadinessService({
    validateSettingsPaths: async () => ({
      ...createHealthyValidation(),
      downloadMappings: [{ status: 'unavailable' }],
    }),
  });

  const result = await service.getAutomaticDownloadFolderReadiness({ settings: createSettings() });

  assert.equal(result.ready, false);
  assert.equal(result.reason, AUTOMATIC_DOWNLOAD_SETUP_REASONS.DOWNLOAD_FOLDER_UNAVAILABLE);
});
