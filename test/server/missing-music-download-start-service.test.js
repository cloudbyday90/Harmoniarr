import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicDownloadStartService } from '../../src/server/missing-music/missing-music-download-start-service.js';

function createTarget({ isDisabled = false, matchStatus = 'selected' } = {}) {
  return {
    decisionId: 'wanted-amber',
    release: {
      artistName: 'Autechre',
      discoveryRequest: {
        importReviewSummary: {
          matches: [{ matchId: 'candidate-amber', status: matchStatus }],
        },
      },
      releaseTitle: 'Amber',
    },
    targetUser: {
      id: 'listener-1',
      isDisabled,
      username: 'Jamie',
    },
  };
}

function createService({ target = createTarget() } = {}) {
  const recordActivityEventFn = test.mock.fn(async () => {});
  const resolveMissingMusicDecisionTarget = test.mock.fn(async () => target);
  const startImportCandidateExecutionRun = test.mock.fn(async () => ({
    accepted: true,
    run: { id: 'execution-amber' },
  }));
  const projectMusicQueueReleaseFn = test.mock.fn(() => ({
    status: { nextAction: 'download_now' },
  }));
  const service = createMissingMusicDownloadStartService({
    projectMusicQueueReleaseFn,
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget,
    startImportCandidateExecutionRun,
  });

  return {
    projectMusicQueueReleaseFn,
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget,
    service,
    startImportCandidateExecutionRun,
  };
}

test('an administrator starts one selected Missing Music match through a scoped execution run', async () => {
  const {
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget,
    service,
    startImportCandidateExecutionRun,
  } = createService();
  const actorUser = { id: 'admin-1', role: 'admin', username: 'admin' };

  const result = await service.startMissingMusicDecisionDownload({
    actorUser,
    decisionId: 'wanted-amber',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });

  assert.deepEqual(resolveMissingMusicDecisionTarget.mock.calls[0].arguments[0], {
    actorUser,
    decisionId: 'wanted-amber',
  });
  assert.deepEqual(startImportCandidateExecutionRun.mock.calls[0].arguments[0], {
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    selectedCandidateId: 'candidate-amber',
    sourceWantedReleaseId: 'wanted-amber',
    triggeredByUserId: 'admin-1',
    triggerSource: 'missing_music_manual',
  });
  assert.deepEqual(result.action, {
    code: 'start_download',
    decisionId: 'wanted-amber',
    downloadPreparationStarted: true,
    matchId: 'candidate-amber',
    operationRunId: 'execution-amber',
    targetUserId: 'listener-1',
  });
  assert.deepEqual(recordActivityEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'admin-1',
    entityArtist: 'Autechre',
    entityId: 'wanted-amber',
    entityTitle: 'Amber',
    entityType: 'wanted_release',
    eventType: 'music_queue_download_queued',
    extraPayload: {
      importCandidateId: 'candidate-amber',
      operationRunId: 'execution-amber',
      schemaVersion: 1,
      wantedReleaseId: 'wanted-amber',
    },
  });
});

test('download start rejects disabled history and non-administrators before creating a run', async () => {
  const disabled = createService({ target: createTarget({ isDisabled: true }) });
  await assert.rejects(
    () => disabled.service.startMissingMusicDecisionDownload({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_decision_read_only',
  );
  assert.equal(disabled.startImportCandidateExecutionRun.mock.callCount(), 0);

  const requester = createService();
  await assert.rejects(
    () => requester.service.startMissingMusicDecisionDownload({
      actorUser: { id: 'listener-1', role: 'requester', username: 'Jamie' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 403 && error?.code === 'missing_music_download_admin_required',
  );
  assert.equal(requester.startImportCandidateExecutionRun.mock.callCount(), 0);
});

test('download start rejects a stale selection or a release that is no longer ready', async () => {
  const stale = createService({ target: createTarget({ matchStatus: 'pending' }) });
  await assert.rejects(
    () => stale.service.startMissingMusicDecisionDownload({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_download_not_ready',
  );
  assert.equal(stale.startImportCandidateExecutionRun.mock.callCount(), 0);

  const noLongerReady = createService();
  noLongerReady.projectMusicQueueReleaseFn.mock.mockImplementation(() => ({
    status: { nextAction: 'open_downloader' },
  }));
  await assert.rejects(
    () => noLongerReady.service.startMissingMusicDecisionDownload({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_download_not_ready',
  );
  assert.equal(noLongerReady.startImportCandidateExecutionRun.mock.callCount(), 0);
});
