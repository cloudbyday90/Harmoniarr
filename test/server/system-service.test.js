import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemService } from '../../src/server/system-service.js';

test('createSystemService reuses shared settings validation and configured paths in overview payloads', async (t) => {
  const dependencyHealthService = {
    getDependencyHealth: t.mock.fn(async () => [{
      provider: 'musicbrainz',
      status: 'healthy',
      observedAt: '2026-04-30T20:00:00.000Z',
    }]),
  };
  const settingsService = {
    buildSettingsPayload: t.mock.fn(async () => ({
      settings: {
        paths: {
          downloadMappings: [{
            slskdPrefix: '/downloads/completed',
            harmoniarrPrefix: '/srv/downloads/completed',
          }],
          downloads: '/srv/downloads',
          music: '/srv/music',
          staging: '/srv/staging',
          transcodeTemp: '/srv/transcode',
        },
      },
      pathValidation: {
        checkedAt: '2026-04-30T21:00:00.000Z',
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
    })),
  };
  const pool = {
    query: t.mock.fn(async () => ({ rows: [{ name: 'harmoniarr_test' }] })),
  };
  const systemService = createSystemService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '15 minutes',
      intervalMs: 900000,
      mode: 'automatic',
      source: 'default',
    },
    startedAt: new Date('2026-04-30T18:00:00.000Z'),
    packageJsonPath: 'ignored-for-test',
    dependencyHealthService,
    getMigrationStatusFn: async () => ({ applied: 4, pending: ['20260430_add_paths.sql'] }),
    getPoolFn: () => pool,
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    settingsService,
  });

  const overview = await systemService.getOverview({ includeDependencies: true });

  assert.equal(settingsService.buildSettingsPayload.mock.callCount(), 1);
  assert.equal(dependencyHealthService.getDependencyHealth.mock.callCount(), 1);
  assert.equal(pool.query.mock.callCount(), 1);
  assert.deepEqual(overview.discoveryHeartbeat, {
    intervalLabel: '15 minutes',
    intervalMs: 900000,
    mode: 'automatic',
    source: 'default',
  });
  assert.deepEqual(overview.pathValidation, {
    checkedAt: '2026-04-30T21:00:00.000Z',
    configuredDownloadMappings: 1,
    summary: {
      status: 'degraded',
      message: 'Validation needs attention',
    },
  });
  assert.equal(overview.paths.find((entry) => entry.label === 'Downloads').value, '/srv/downloads');
  assert.equal(overview.paths.find((entry) => entry.label === 'Music library').value, '/srv/music');
});

test('createSystemService can omit dependency checks while preserving validation summary', async (t) => {
  const dependencyHealthService = {
    getDependencyHealth: t.mock.fn(async () => []),
  };
  const systemService = createSystemService({
    libraryDiscoveryHeartbeatConfig: {
      intervalLabel: '30 minutes',
      intervalMs: 1800000,
      mode: 'automatic',
      source: 'environment',
    },
    startedAt: new Date('2026-04-30T18:00:00.000Z'),
    packageJsonPath: 'ignored-for-test',
    dependencyHealthService,
    getMigrationStatusFn: async () => ({ applied: 2, pending: [] }),
    getPoolFn: () => ({ query: async () => ({ rows: [{ name: 'harmoniarr_test' }] }) }),
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: { paths: {} },
        pathValidation: {
          checkedAt: '2026-04-30T21:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  const overview = await systemService.getOverview({ includeDependencies: false });

  assert.equal(dependencyHealthService.getDependencyHealth.mock.callCount(), 0);
  assert.deepEqual(overview.dependencies, []);
  assert.equal(overview.discoveryHeartbeat.intervalLabel, '30 minutes');
  assert.equal(overview.pathValidation.summary.status, 'healthy');
});