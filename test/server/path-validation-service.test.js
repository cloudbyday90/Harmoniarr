import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathValidationService } from '../../src/server/paths/path-validation-service.js';

function createStats({ isDirectory = true } = {}) {
  return {
    isDirectory() {
      return isDirectory;
    },
  };
}

function createSettings(overrides = {}) {
  return {
    system: {
      baseUrl: '',
      logLevel: 'info',
    },
    paths: {
      downloadMappings: [{
        slskdPrefix: '/downloads/completed',
        harmoniarrPrefix: '/data/downloads/completed',
      }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
    },
    ...overrides,
  };
}

test('createPathValidationService reports healthy roots and translated mapping examples', async () => {
  const service = createPathValidationService({
    accessFn: async () => {},
    realpathFn: async (value) => value,
    statFn: async () => createStats(),
  });

  const result = await service.validateSettingsPaths(createSettings());

  assert.equal(result.summary.status, 'healthy');
  assert.equal(result.roots[0].status, 'healthy');
  assert.equal(result.downloadMappings[0].exampleTranslatedPath, '/data/downloads/completed/Example Artist/Example Album');
});

test('createPathValidationService degrades when translated local roots are unreadable', async () => {
  const service = createPathValidationService({
    accessFn: async (value, mode) => {
      if (value === '/data/downloads/completed') {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        throw error;
      }
    },
    realpathFn: async (value) => value,
    statFn: async () => createStats(),
  });

  const result = await service.validateSettingsPaths(createSettings());

  assert.equal(result.summary.status, 'degraded');
  assert.equal(result.downloadMappings[0].status, 'degraded');
});

test('createPathValidationService preserves UNC prefixes in example source paths', async () => {
  const service = createPathValidationService({
    accessFn: async () => {},
    realpathFn: async (value) => value,
    statFn: async () => createStats(),
  });

  const result = await service.validateSettingsPaths(createSettings({
    paths: {
      downloadMappings: [{
        slskdPrefix: '//slskd-host/downloads/completed',
        harmoniarrPrefix: '/data/downloads/completed',
      }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
    },
  }));

  assert.equal(result.downloadMappings[0].exampleSourcePath, '//slskd-host/downloads/completed/Example Artist/Example Album');
});

test('createPathValidationService marks missing roots unavailable and warns when no mappings exist', async () => {
  const service = createPathValidationService({
    accessFn: async () => {},
    realpathFn: async (value) => value,
    statFn: async (value) => {
      if (value === '/data/staging') {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      }

      return createStats();
    },
  });

  const result = await service.validateSettingsPaths(createSettings({
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
    },
  }));

  assert.equal(result.summary.status, 'unavailable');
  assert.equal(result.roots.find((root) => root.key === 'staging').status, 'unavailable');
  assert.match(result.summary.message, /No explicit slskd download mappings/);
});