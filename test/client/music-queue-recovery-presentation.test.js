import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMusicQueueRecoveryPresentation } from '../../src/client/lib/music-queue-recovery-presentation.js';

test('Music Queue recovery keeps next-match and scheduled-search recovery automatic', () => {
  for (const code of ['trying_next_match', 'retrying_search']) {
    const recovery = buildMusicQueueRecoveryPresentation({ code });

    assert.equal(recovery.kind, 'automatic');
    assert.equal(recovery.canSearchAgain, undefined);
    assert.match(recovery.nextStep, /No action is needed/i);
  }
});

test('Music Queue recovery gives exhausted and failed searches one explicit retry action', () => {
  const exhausted = buildMusicQueueRecoveryPresentation({ code: 'no_matches_left' });
  const failed = buildMusicQueueRecoveryPresentation({ code: 'failed' });

  assert.deepEqual(
    { canSearchAgain: exhausted.canSearchAgain, retryLabel: exhausted.retryLabel },
    { canSearchAgain: true, retryLabel: 'Search again' },
  );
  assert.deepEqual(
    { canSearchAgain: failed.canSearchAgain, retryLabel: failed.retryLabel },
    { canSearchAgain: true, retryLabel: 'Try again' },
  );
});
