import assert from 'node:assert/strict';
import test from 'node:test';
import { createOnboardingSummaryService } from '../../src/server/onboarding-summary-service.js';

test('unavailable migration observation counts as an issue without becoming a pending migration or a ready summary', async () => {
  const dependencies = {
    backgroundJobHealthService: { getWorkerHealth: async () => ({ status: 'healthy' }) },
    libraryScanSummaryService: { buildLibraryScanSummary: async () => ({ readiness: { status: 'ready' }, summary: { message: 'Ready.' } }) },
    musicBrainzSearchService: { checkProviderHealth: async () => ({ status: 'healthy' }) },
    settingsService: { buildSettingsPayload: async () => ({ settings: { paths: {} }, pathValidation: { summary: { status: 'healthy' } } }) },
    slskdService: { getConnectionStatus: async () => ({ status: 'healthy', details: { isConnected: true } }), validateAuthentication: async () => ({ isValid: true }) },
  };
  const current = await createOnboardingSummaryService({ ...dependencies, getMigrationStatusFn: async () => ({ applied: 115, pending: [] }) }).buildOnboardingSummary();
  assert.equal(current.summary.status, 'complete'); assert.equal(current.summary.issueCount, 0);
  for (const failure of [new Error('private database path /secret'), null]) {
    const result = await createOnboardingSummaryService({ ...dependencies, getMigrationStatusFn: async () => { throw failure; } }).buildOnboardingSummary();
    assert.equal(result.steps.find(step => step.id === 'database').status, 'unavailable');
    assert.equal(result.summary.status, 'attention'); assert.equal(result.summary.issueCount, current.summary.issueCount + 1);
    assert.equal(result.summary.message, '1 setup item needs attention before scans or imports.');
    assert.equal(result.summary.completeStepCount, current.summary.completeStepCount - 1);
    assert.equal(result.summary.totalStepCount, current.summary.totalStepCount);
    assert.doesNotMatch(JSON.stringify(result), /private|secret|migration_status_unavailable|1 migration/u);
  }
});

test('createOnboardingSummaryService turns shared health checks into actionable checklist steps', async () => {
  const service = createOnboardingSummaryService({
    backgroundJobHealthService: {
      getWorkerHealth: async () => ({
        activeLeaseCount: 0,
        runningOperationCount: 0,
        status: 'informational',
        message: 'No active background worker leases are reporting yet. This remains informational until worker slices land.',
      }),
    },
    getMigrationStatusFn: async () => ({ applied: 4, pending: [] }),
    libraryScanSummaryService: {
      buildLibraryScanSummary: async () => ({
        checkedAt: '2026-04-30T22:15:00.000Z',
        libraryRoot: '/srv/music',
        readiness: {
          status: 'ready',
          message: 'Shared library and staging paths are ready for the first library scan.',
        },
        summary: {
          status: 'not_started',
          message: 'Library paths are ready, but no library scan has been recorded yet.',
        },
        latestRun: null,
        nextAction: null,
      }),
    },
    musicBrainzSearchService: {
      checkProviderHealth: async () => ({
        provider: 'musicbrainz',
        status: 'healthy',
        message: 'MusicBrainz lookups are reachable.',
      }),
    },
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
          checkedAt: '2026-04-30T22:00:00.000Z',
          summary: {
            status: 'degraded',
            message: 'Validation needs attention',
          },
        },
      }),
    },
    slskdService: {
      getConnectionStatus: async () => ({
        provider: 'slskd',
        status: 'healthy',
        details: {
          isConnected: true,
          isLoggedIn: true,
          isTransitioning: false,
        },
      }),
      validateAuthentication: async () => ({
        provider: 'slskd',
        isValid: true,
      }),
    },
  });

  const summary = await service.buildOnboardingSummary();

  assert.equal(summary.summary.status, 'attention');
  assert.equal(summary.summary.issueCount, 1);
  assert.deepEqual(summary.nextAction, {
    label: 'Open Settings',
    to: '/app/settings',
  });
  assert.deepEqual(summary.steps.map((step) => ({ id: step.id, status: step.status })), [
    { id: 'paths', status: 'attention' },
    { id: 'slskd-connection', status: 'complete' },
    { id: 'slskd-authentication', status: 'complete' },
    { id: 'metadata-provider', status: 'complete' },
    { id: 'database', status: 'complete' },
    { id: 'library-scan', status: 'info' },
    { id: 'background-workers', status: 'info' },
  ]);
});

test('createOnboardingSummaryService keeps the checklist available when provider checks fail', async () => {
  const service = createOnboardingSummaryService({
    backgroundJobHealthService: {
      getWorkerHealth: async () => ({
        activeLeaseCount: 1,
        runningOperationCount: 0,
        status: 'healthy',
        message: 'Background worker activity is reporting through active leases or running operations.',
      }),
    },
    getMigrationStatusFn: async () => ({ applied: 4, pending: [] }),
    libraryScanSummaryService: {
      buildLibraryScanSummary: async () => ({
        checkedAt: '2026-04-30T22:15:00.000Z',
        libraryRoot: '/srv/music',
        readiness: {
          status: 'blocked',
          message: 'Resolve shared path validation issues before running a library scan.',
        },
        summary: {
          status: 'blocked',
          message: 'Resolve shared path validation issues before running a library scan.',
        },
        latestRun: null,
        nextAction: {
          label: 'Open Settings',
          to: '/app/settings',
        },
      }),
    },
    musicBrainzSearchService: {
      checkProviderHealth: async () => {
        const error = new Error('MusicBrainz is throttled');
        error.code = 'musicbrainz_unavailable';
        error.details = { throttled: true, retryAfterMs: 2000 };
        throw error;
      },
    },
    settingsService: {
      buildSettingsPayload: async () => ({
        settings: { paths: { downloadMappings: [] } },
        pathValidation: {
          checkedAt: '2026-04-30T22:00:00.000Z',
          summary: {
            status: 'healthy',
            message: 'Validated',
          },
        },
      }),
    },
    slskdService: {
      getConnectionStatus: async () => ({
        provider: 'slskd',
        status: 'unavailable',
        message: 'slskd is temporarily unavailable',
        details: {
          isConnected: false,
          isLoggedIn: false,
          isTransitioning: false,
        },
      }),
      validateAuthentication: async () => ({
        provider: 'slskd',
        isValid: false,
      }),
    },
  });

  const summary = await service.buildOnboardingSummary();

  assert.equal(summary.summary.status, 'attention');
  assert.equal(summary.summary.issueCount, 4);
  assert.equal(summary.steps.find((step) => step.id === 'metadata-provider').message, 'MusicBrainz is throttling requests');
  assert.equal(summary.steps.find((step) => step.id === 'slskd-authentication').message, 'Connect to Soulseek before verifying credentials.');
  assert.equal(summary.steps.find((step) => step.id === 'library-scan').status, 'attention');
});
