import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicReleaseRecoveryPresentation } from '../../src/client/lib/missing-music-release-recovery-presentation.js';

test('Missing Music recovery keeps next-match and scheduled-search recovery automatic', () => {
  for (const code of ['trying_next_match', 'retrying_search']) {
    const recovery = buildMissingMusicReleaseRecoveryPresentation({ code });

    assert.equal(recovery.kind, 'automatic');
    assert.equal(recovery.canSearchAgain, undefined);
    assert.match(recovery.nextStep, /No action is needed/i);
  }
});

test('Missing Music recovery gives exhausted and failed searches one explicit retry action', () => {
  const exhausted = buildMissingMusicReleaseRecoveryPresentation({ code: 'no_matches_left' });
  const failed = buildMissingMusicReleaseRecoveryPresentation({ code: 'failed' });

  assert.deepEqual(
    { canSearchAgain: exhausted.canSearchAgain, retryLabel: exhausted.retryLabel },
    { canSearchAgain: true, retryLabel: 'Search again' },
  );
  assert.deepEqual(
    { canSearchAgain: failed.canSearchAgain, retryLabel: failed.retryLabel },
    { canSearchAgain: true, retryLabel: 'Try again' },
  );
});
