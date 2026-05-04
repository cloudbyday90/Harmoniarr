import assert from 'node:assert/strict';
import test from 'node:test';

import { createStartupValidationService } from '../../src/server/startup-validation-service.js';

function createSettings(overrides = {}) {
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
      userMusicRoots: [],
    },
    ...overrides,
  };
}

test('createStartupValidationService validates startup-critical config, database reachability, and runtime paths', async () => {
  const calls = [];
  const service = createStartupValidationService({
    appDataPath: '/app/data',
    env: {
      HARMONIARR_BOOTSTRAP_OWNER_USERNAME: 'owner',
      HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE: '0123456789abcdef',
      HARMONIARR_SECRET_ENCRYPTION_KEY: '',
    },
    getPoolFn: () => ({
      async query(sql) {
        calls.push(`query:${sql}`);
      },
    }),
    loadSettingsFn: async () => {
      calls.push('loadSettings');
      return createSettings();
    },
    pathValidationService: {
      async validateRuntimePaths({ appDataPath, settings }) {
        calls.push(`validateRuntimePaths:${appDataPath}:${settings.paths.downloads}`);
        return {
          appData: {
            label: 'App data root',
            message: 'Directory exists and satisfies the required read and write checks.',
            status: 'healthy',
          },
          settingsPathValidation: {
            roots: [
              {
                label: 'Downloads root',
                message: 'Directory exists and satisfies the required read checks.',
                status: 'healthy',
              },
              {
                label: 'Staging root',
                message: 'Directory exists and satisfies the required read and write checks.',
                status: 'healthy',
              },
            ],
          },
        };
      },
    },
  });

  const result = await service.assertStartupReady();

  assert.deepEqual(calls, [
    'query:SELECT 1',
    'loadSettings',
    'validateRuntimePaths:/app/data:/data/downloads',
  ]);
  assert.equal(result.blockingPathIssues.length, 0);
});

test('createStartupValidationService fails closed on unavailable runtime roots', async () => {
  const service = createStartupValidationService({
    appDataPath: '/app/data',
    env: {},
    getPoolFn: () => ({
      async query() {},
    }),
    loadSettingsFn: async () => createSettings(),
    pathValidationService: {
      async validateRuntimePaths() {
        return {
          appData: {
            label: 'App data root',
            message: 'Configured path is not reachable from Harmoniarr. (ENOENT)',
            status: 'unavailable',
          },
          settingsPathValidation: {
            roots: [
              {
                label: 'Downloads root',
                message: 'Directory exists and satisfies the required read checks.',
                status: 'healthy',
              },
              {
                label: 'Staging root',
                message: 'Configured directory exists but is not writable. (EACCES)',
                status: 'degraded',
              },
            ],
          },
        };
      },
    },
  });

  await assert.rejects(
    () => service.assertStartupReady(),
    /Startup validation failed: App data root: Configured path is not reachable from Harmoniarr\. \(ENOENT\) Staging root: Configured directory exists but is not writable\. \(EACCES\)/,
  );
});

test('createStartupValidationService surfaces invalid bootstrap owner claim configuration', async () => {
  const service = createStartupValidationService({
    env: {
      HARMONIARR_BOOTSTRAP_OWNER_USERNAME: 'owner',
    },
    getPoolFn: () => ({
      async query() {
        throw new Error('query should not run when config is invalid');
      },
    }),
    loadSettingsFn: async () => createSettings(),
    pathValidationService: {
      async validateRuntimePaths() {
        throw new Error('path validation should not run when config is invalid');
      },
    },
  });

  await assert.rejects(
    () => service.assertStartupReady(),
    /HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured\./,
  );
});