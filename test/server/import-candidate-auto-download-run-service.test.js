import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE,
  createImportCandidateAutoDownloadRunService,
} from '../../src/server/import-candidates/import-candidate-auto-download-run-service.js';

const selectedAutoSelection = Object.freeze({
  selected: true,
  selectedCandidateId: 'candidate-1',
  sourceSearchId: 'search-1',
});

test('startDownloadRunAfterAutoSelection starts a download run for healthy high-confidence selections', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async () => ({
    run: {
      id: 'run-1',
    },
  }));
  const service = createImportCandidateAutoDownloadRunService({
    getProviderStatus: t.mock.fn(async () => ({ provider: 'slskd', status: 'healthy' })),
    loadSettingsFn: t.mock.fn(async () => ({
      library: {
        autoStartDownloadsAfterSelection: true,
      },
    })),
    startImportCandidateExecutionRun,
  });

  const requestMetadata = {
    ipAddress: '198.51.100.24',
    userAgent: 'AutoDownloadStartTest/1.0',
  };
  const result = await service.startDownloadRunAfterAutoSelection({
    actorUserId: 'operator-1',
    autoSelectionResult: selectedAutoSelection,
    requestMetadata,
  });

  assert.deepEqual(startImportCandidateExecutionRun.mock.calls[0].arguments[0], {
    requestMetadata,
    selectedCandidateId: 'candidate-1',
    sourceSearchId: 'search-1',
    triggeredByUserId: 'operator-1',
    triggerSource: AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE,
  });
  assert.deepEqual(result, {
    attempted: true,
    runId: 'run-1',
    selectedCandidateId: 'candidate-1',
    sourceSearchId: 'search-1',
    started: true,
    triggerSource: AUTO_DOWNLOAD_RUN_TRIGGER_SOURCE,
  });
});

test('startDownloadRunAfterAutoSelection skips when library automation is disabled', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async () => {
    throw new Error('download run should not start');
  });
  const service = createImportCandidateAutoDownloadRunService({
    getProviderStatus: t.mock.fn(async () => ({ provider: 'slskd', status: 'healthy' })),
    loadSettingsFn: t.mock.fn(async () => ({
      library: {
        autoStartDownloadsAfterSelection: false,
      },
    })),
    startImportCandidateExecutionRun,
  });

  const result = await service.startDownloadRunAfterAutoSelection({
    autoSelectionResult: selectedAutoSelection,
  });

  assert.equal(startImportCandidateExecutionRun.mock.callCount(), 0);
  assert.equal(result.started, false);
  assert.equal(result.skippedReason, 'automatic_download_start_disabled');
});

test('startDownloadRunAfterAutoSelection skips when slskd is not healthy', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async () => {
    throw new Error('download run should not start');
  });
  const service = createImportCandidateAutoDownloadRunService({
    getProviderStatus: t.mock.fn(async () => ({
      message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
      provider: 'slskd',
      status: 'disabled',
    })),
    loadSettingsFn: t.mock.fn(async () => ({ library: {} })),
    startImportCandidateExecutionRun,
  });

  const result = await service.startDownloadRunAfterAutoSelection({
    autoSelectionResult: selectedAutoSelection,
  });

  assert.equal(startImportCandidateExecutionRun.mock.callCount(), 0);
  assert.equal(result.provider, 'slskd');
  assert.equal(result.providerStatus, 'disabled');
  assert.equal(result.skippedReason, 'provider_not_healthy');
});

test('startDownloadRunAfterAutoSelection reports active-run conflicts without throwing', async () => {
  const conflict = new Error('An import execution planning run is already running or queued');
  conflict.code = 'import_candidate_execution_in_progress';
  const service = createImportCandidateAutoDownloadRunService({
    getProviderStatus: async () => ({ provider: 'slskd', status: 'healthy' }),
    loadSettingsFn: async () => ({ library: {} }),
    startImportCandidateExecutionRun: async () => {
      throw conflict;
    },
  });

  const result = await service.startDownloadRunAfterAutoSelection({
    autoSelectionResult: selectedAutoSelection,
  });

  assert.equal(result.started, false);
  assert.equal(result.errorCode, 'import_candidate_execution_in_progress');
  assert.equal(result.skippedReason, 'import_candidate_execution_in_progress');
});
