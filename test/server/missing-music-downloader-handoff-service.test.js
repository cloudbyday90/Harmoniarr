import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicDownloaderHandoffService } from '../../src/server/missing-music/missing-music-downloader-handoff-service.js';

function createService({ nextAction = 'open_downloader' } = {}) {
  const target = {
    decisionId: 'wanted-amber',
    release: {
      artistName: 'Autechre',
      privateProviderPayload: { transferId: 'provider-transfer-must-not-leak', username: 'provider-user-must-not-leak' },
      releaseTitle: 'Amber',
    },
    targetUser: { id: 'listener-1', username: 'Jamie' },
  };
  const resolveMissingMusicDecisionTarget = test.mock.fn(async () => target);
  const projectMusicQueueReleaseFn = test.mock.fn((release) => ({
    artistName: release.artistName,
    releaseTitle: release.releaseTitle,
    status: { nextAction },
  }));
  const service = createMissingMusicDownloaderHandoffService({
    projectMusicQueueReleaseFn,
    resolveMissingMusicDecisionTarget,
  });

  return { resolveMissingMusicDecisionTarget, service };
}

test('an administrator receives a minimal server-resolved Downloader handoff without provider data', async () => {
  const { resolveMissingMusicDecisionTarget, service } = createService();

  const result = await service.getMissingMusicDownloaderHandoff({
    actorUser: { id: 'admin-1', role: 'admin', username: 'Admin' },
    decisionId: 'wanted-amber',
  });

  assert.deepEqual(resolveMissingMusicDecisionTarget.mock.calls[0].arguments[0], {
    actorUser: { id: 'admin-1', role: 'admin', username: 'Admin' },
    decisionId: 'wanted-amber',
  });
  assert.deepEqual(result, {
    decisionId: 'wanted-amber',
    release: { artistName: 'Autechre', title: 'Amber' },
    requestedFor: { username: 'Jamie' },
    wantedReleaseId: 'wanted-amber',
  });
  assert.doesNotMatch(JSON.stringify(result), /provider-(?:transfer|user)-must-not-leak/u);
  assert.doesNotMatch(JSON.stringify(result), /listener-1/u);
});

test('a handoff is unavailable unless the administrator is viewing a submitted transfer', async () => {
  const { service } = createService({ nextAction: 'review_matches' });

  await assert.rejects(
    () => service.getMissingMusicDownloaderHandoff({
      actorUser: { id: 'admin-1', role: 'admin' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_downloader_unavailable',
  );
});

test('a non-administrator cannot resolve a Downloader handoff', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.getMissingMusicDownloaderHandoff({
      actorUser: { id: 'listener-1', role: 'requester' },
      decisionId: 'wanted-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_downloader_unavailable',
  );
});
