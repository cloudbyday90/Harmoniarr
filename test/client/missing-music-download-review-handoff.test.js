import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { buildMissingMusicDownloadReviewLocation, useMissingMusicDownloadReviewHandoff } from '../../src/client/composables/useMissingMusicDownloadReviewHandoff.js';

test('canonical review uses only server-resolved opaque run and candidate context in existing route forms', () => {
  assert.deepEqual(buildMissingMusicDownloadReviewLocation({ operationRunId: 'run', importCandidateId: 'candidate', username: 'private-peer' }), {
    name: 'activity-diagnostics-matches', hash: '#import-execution-run-panel', query: { candidate: 'candidate', executionRunId: 'run', status: 'selected' } });
  assert.equal(buildMissingMusicDownloadReviewLocation({ operationRunId: 'run' }), null);
});

test('canonical review ignores stale navigation and exposes fixed errors instead of provider details', async (t) => {
  const decisionId = ref('first'); let finish; let signal;
  const workflow = useMissingMusicDownloadReviewHandoff({ decisionId, fetchContext: (id, options) => {
    signal = options.signal; return new Promise((resolve) => { finish = resolve; });
  } });
  t.after(workflow.destroy);
  const first = workflow.loadLocation(); decisionId.value = 'second'; assert.equal(signal.aborted, true);
  finish({ decisionId: 'first', operationRunId: 'run', importCandidateId: 'candidate' }); assert.equal(await first, null);
  const denied = useMissingMusicDownloadReviewHandoff({ decisionId: 'second', fetchContext: async () => { throw new Error('private provider URL'); } });
  t.after(denied.destroy); await denied.loadLocation(); assert.doesNotMatch(denied.errorMessage.value, /private/u);
});
