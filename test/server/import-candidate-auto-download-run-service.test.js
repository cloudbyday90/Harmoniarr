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

test('automatic preparation reads existing default and explicit readiness without starting a download run', async (t) => {
  for (const library of [{}, { autoStartDownloadsAfterSelection: true }]) {
    const settings = { library, paths: { downloads: 'controlled-downloads' } };
    const folders = t.mock.fn(async () => ({ ready: true }));
    const start = t.mock.fn(async () => assert.fail('read-only preparation cannot start a run'));
    const service = createImportCandidateAutoDownloadRunService({ loadSettingsFn: async () => settings,
      getAutomaticDownloadFolderReadiness: folders, getProviderStatus: async () => ({ status: 'healthy' }),
      startImportCandidateExecutionRun: start });
    assert.deepEqual(await service.prepareAutomaticDownloadStart(), { ready: true });
    assert.equal(folders.mock.calls[0].arguments[0].settings, settings);
    assert.equal(start.mock.callCount(), 0);
  }
});

test('disabled or invalid automatic-start settings stop preparation before folder or provider work', async (t) => {
  for (const value of [false, null, 0, 'true']) {
    const folders = t.mock.fn(async () => assert.fail('disabled preparation cannot check folders'));
    const provider = t.mock.fn(async () => assert.fail('disabled preparation cannot check provider'));
    const start = t.mock.fn(async () => assert.fail('disabled preparation cannot start a run'));
    const service = createImportCandidateAutoDownloadRunService({ loadSettingsFn: async () => ({ library: { autoStartDownloadsAfterSelection: value } }),
      getAutomaticDownloadFolderReadiness: folders, getProviderStatus: provider, startImportCandidateExecutionRun: start });
    assert.deepEqual(await service.prepareAutomaticDownloadStart(), { ready: false, skippedReason: 'automatic_download_start_disabled' });
    assert.equal(folders.mock.callCount(), 0); assert.equal(provider.mock.callCount(), 0); assert.equal(start.mock.callCount(), 0);
  }
});

test('unavailable settings return a bounded preparation outcome without later work', async () => {
  const service = createImportCandidateAutoDownloadRunService({ loadSettingsFn: async () => { const error = new Error('controlled'); error.code = 'controlled_settings_failure'; throw error; },
    getAutomaticDownloadFolderReadiness: async () => assert.fail('failed settings cannot check folders'),
    getProviderStatus: async () => assert.fail('failed settings cannot check provider'),
    startImportCandidateExecutionRun: async () => assert.fail('failed settings cannot start a run') });
  assert.deepEqual(await service.prepareAutomaticDownloadStart(), { ready: false, skippedReason: 'settings_unavailable', errorCode: 'controlled_settings_failure' });
});

test('folder refusal or unavailable tooling preserves the existing reason and performs no provider or queue work', async () => {
  for (const [folders, setupReason] of [[async () => ({ ready: false, reason: 'controlled_folder_missing', message: 'Set up downloads' }), 'controlled_folder_missing'],
    [async () => { throw new Error('controlled folder failure'); }, 'download_folder_unavailable'], [null, 'download_folder_unavailable']]) {
    const service = createImportCandidateAutoDownloadRunService({ loadSettingsFn: async () => ({ library: {} }),
      getAutomaticDownloadFolderReadiness: folders,
      getProviderStatus: async () => assert.fail('unready folders cannot check provider'),
      startImportCandidateExecutionRun: async () => assert.fail('unready folders cannot start a run') });
    const result = await service.prepareAutomaticDownloadStart();
    assert.equal(result.ready, false);
    assert.equal(result.skippedReason, result.setupReason);
    assert.equal(result.setupReason, setupReason);
  }
});

test('unhealthy, missing and failed provider status checks never start a prepared download', async () => {
  for (const [getProviderStatus, reason] of [[async () => ({ status: 'disabled' }), 'provider_not_healthy'],
    [async () => null, 'provider_not_healthy'], [null, 'provider_status_unavailable'],
    [async () => { throw new Error('controlled provider failure'); }, 'provider_status_unavailable']]) {
    const service = createImportCandidateAutoDownloadRunService({ loadSettingsFn: async () => ({ library: {} }),
      getAutomaticDownloadFolderReadiness: async () => ({ ready: true }), getProviderStatus,
      startImportCandidateExecutionRun: async () => assert.fail('provider refusal cannot start a run') });
    const result = await service.prepareAutomaticDownloadStart();
    assert.equal(result.ready, false); assert.equal(result.skippedReason, reason); assert.equal(result.provider, 'slskd');
  }
});

test('startDownloadRunAfterAutoSelection starts a download run for healthy high-confidence selections', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async () => ({
    run: {
      id: 'run-1',
    },
  }));
  const service = createImportCandidateAutoDownloadRunService({
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({ ready: true })),
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
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({ ready: true })),
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
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({ ready: true })),
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
    getAutomaticDownloadFolderReadiness: async () => ({ ready: true }),
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

test('startDownloadRunAfterAutoSelection blocks provider enqueue when managed folders are not ready', async (t) => {
  const getProviderStatus = t.mock.fn(async () => ({ provider: 'slskd', status: 'healthy' }));
  const startImportCandidateExecutionRun = t.mock.fn(async () => ({ run: { id: 'run-1' } }));
  const service = createImportCandidateAutoDownloadRunService({
    getAutomaticDownloadFolderReadiness: t.mock.fn(async () => ({
      message: 'Finish folder setup before Harmoniarr can start downloads automatically.',
      ready: false,
      reason: 'missing_download_folder',
    })),
    getProviderStatus,
    loadSettingsFn: t.mock.fn(async () => ({ library: {} })),
    startImportCandidateExecutionRun,
  });

  const result = await service.startDownloadRunAfterAutoSelection({
    autoSelectionResult: selectedAutoSelection,
  });

  assert.equal(result.started, false);
  assert.equal(result.setupReason, 'missing_download_folder');
  assert.equal(result.skippedReason, 'missing_download_folder');
  assert.equal(getProviderStatus.mock.callCount(), 0);
  assert.equal(startImportCandidateExecutionRun.mock.callCount(), 0);
});
