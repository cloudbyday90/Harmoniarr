import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryScanSummaryService } from '../../src/server/library-scan-summary-service.js';

test('createLibraryScanSummaryService blocks scan readiness when shared path validation is not healthy', async (t) => {
  const libraryScanRunStore = {
    getLatestRun: t.mock.fn(async () => null),
  };
  const service = createLibraryScanSummaryService({
    libraryScanRunStore,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            downloadMappings: [],
            music: '/srv/music',
          },
        },
        pathValidation: {
          checkedAt: '2026-04-30T23:00:00.000Z',
          summary: {
            status: 'degraded',
            message: 'Validation needs attention',
          },
        },
      }),
    },
  });

  const summary = await service.buildLibraryScanSummary();

  assert.equal(libraryScanRunStore.getLatestRun.mock.callCount(), 1);
  assert.equal(summary.readiness.status, 'blocked');
  assert.equal(summary.summary.status, 'blocked');
  assert.deepEqual(summary.nextAction, {
    label: 'Open Settings',
    to: '/app/settings',
  });
  assert.equal(summary.latestRun, null);
});

test('createLibraryScanSummaryService reports the latest completed scan run when paths are ready', async (t) => {
  const libraryScanRunStore = {
    getLatestRun: t.mock.fn(async () => ({
      id: 'run-1',
      status: 'completed',
      startedAt: '2026-04-30T20:00:00.000Z',
      finishedAt: '2026-04-30T20:05:00.000Z',
      filesSeen: 42,
      filesMatched: 39,
      filesUnmatched: 3,
      errorMessage: null,
    })),
  };
  const service = createLibraryScanSummaryService({
    libraryScanRunStore,
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: {
          paths: {
            downloadMappings: [{ slskdPrefix: '/downloads', harmoniarrPrefix: '/srv/downloads' }],
            music: '/srv/music',
          },
        },
        pathValidation: {
          checkedAt: '2026-04-30T23:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
  });

  const summary = await service.buildLibraryScanSummary();

  assert.equal(summary.readiness.status, 'ready');
  assert.equal(summary.summary.status, 'completed');
  assert.equal(summary.summary.message, 'The latest library scan completed after inspecting 42 files.');
  assert.deepEqual(summary.latestRun, {
    id: 'run-1',
    status: 'completed',
    startedAt: '2026-04-30T20:00:00.000Z',
    finishedAt: '2026-04-30T20:05:00.000Z',
    filesSeen: 42,
    filesMatched: 39,
    filesUnmatched: 3,
    errorMessage: null,
  });
  assert.equal(summary.nextAction, null);
});