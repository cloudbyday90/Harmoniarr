import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicDownloadReviewHandoffService } from '../../src/server/missing-music/missing-music-download-review-handoff-service.js';
import { canReviewMissingMusicDownload } from '../../src/server/missing-music/missing-music-download-review-handoff-policy.js';

const release = { artistName: 'Artist', releaseTitle: 'Release', discoveryRequest: { importReviewSummary: {
  currentDownloadHandoff: { confirmationPending: true, operationRunId: 'run', importCandidateId: 'candidate', attemptId: 'private-attempt', peer: 'private-peer', path: '/private/path' } } } };
const target = { decisionId: 'wanted', release, targetUser: { id: 'listener', username: 'Jamie', isDisabled: false } };

test('canonical admin recovery context resolves only the decision and returns bounded existing route identifiers', async () => {
  let observed;
  const service = createMissingMusicDownloadReviewHandoffService({ resolveMissingMusicDecisionTarget: async (args) => { observed = args; return target; } });
  const actorUser = { id: 'admin', role: 'admin' };
  const context = await service.getMissingMusicDownloadReviewHandoff({ actorUser, decisionId: 'wanted', importCandidateId: 'untrusted', targetUserId: 'untrusted' });
  assert.deepEqual(observed, { actorUser, decisionId: 'wanted' });
  assert.deepEqual(context, { decisionId: 'wanted', operationRunId: 'run', importCandidateId: 'candidate',
    release: { artistName: 'Artist', title: 'Release' }, requestedFor: { username: 'Jamie' } });
  assert.doesNotMatch(JSON.stringify(context), /private|attemptId|peer|path|targetUserId/u);
});

test('requesters cannot inspect adoption references and disabled or settled decisions cannot open an actionable recovery handoff', async () => {
  let reads = 0;
  const service = createMissingMusicDownloadReviewHandoffService({ resolveMissingMusicDecisionTarget: async () => { reads += 1; return target; } });
  await assert.rejects(service.getMissingMusicDownloadReviewHandoff({ actorUser: { role: 'requester' }, decisionId: 'wanted' }), (error) => error.status === 403);
  assert.equal(reads, 0);
  assert.equal(canReviewMissingMusicDownload({ actorUser: { role: 'admin' }, targetUser: { isDisabled: true }, release }), false);
  assert.equal(canReviewMissingMusicDownload({ actorUser: { role: 'admin' }, targetUser: {}, release: {} }), false);
});
