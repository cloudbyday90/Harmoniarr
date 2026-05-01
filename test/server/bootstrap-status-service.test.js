import assert from 'node:assert/strict';
import test from 'node:test';
import { createBootstrapStatusService } from '../../src/server/bootstrap-status-service.js';

test('createBootstrapStatusService returns only bootstrapRequired when bootstrap is complete', async (t) => {
  const settingsService = {
    buildSettingsPayload: t.mock.fn(async () => ({ settings: {}, pathValidation: {} })),
  };
  const service = createBootstrapStatusService({
    getBootstrapRequired: async () => false,
    settingsService,
  });

  const payload = await service.buildBootstrapStatusPayload();

  assert.deepEqual(payload, {
    bootstrapRequired: false,
  });
  assert.equal(settingsService.buildSettingsPayload.mock.callCount(), 0);
});

test('createBootstrapStatusService reuses shared settings validation summary during bootstrap', async () => {
  const service = createBootstrapStatusService({
    getBootstrapRequired: async () => true,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            downloadMappings: [{
              slskdPrefix: '/downloads/completed',
              harmoniarrPrefix: '/data/downloads/completed',
            }],
          },
        },
        pathValidation: {
          checkedAt: '2026-04-30T21:00:00.000Z',
          summary: {
            status: 'degraded',
            message: 'Validation needs attention',
          },
        },
      }),
    },
  });

  const payload = await service.buildBootstrapStatusPayload();

  assert.deepEqual(payload, {
    bootstrapRequired: true,
    pathValidation: {
      checkedAt: '2026-04-30T21:00:00.000Z',
      configuredDownloadMappings: 1,
      summary: {
        status: 'degraded',
        message: 'Validation needs attention',
      },
    },
  });
});