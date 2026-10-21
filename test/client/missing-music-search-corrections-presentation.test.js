import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicSearchCorrections as build } from '../../src/client/lib/missing-music-search-corrections-presentation.js';

const counts = { provider: 'slskd', candidateCount: 0, responseCount: 2, responseFileCount: 4,
  ignoredUserResponseCount: 1, malformedFileCount: 1 };
const detail = () => ({ searchDiagnostics: counts, decision: { decisionId: 'decision-one', requestedFor: { accountStatus: 'active' } },
  permissions: { canReviewIgnoredSources: true, canReviewProviderConnection: true, isReadOnly: false } });

test('allowed review uses fixed internal destinations and bounded Settings return context, without commands or raw provider strings', () => {
  const input = detail(); input.searchDiagnostics = { ...counts, url: 'https://private.invalid', username: 'private-peer', reasonCodes: ['private-reason'] };
  const steps = build(input);
  assert.deepEqual(steps.map(step => step.link), [
    { label: 'Review ignored sources', to: { name: 'activity-ignored' } },
    { label: 'Review provider connection', to: { name: 'settings-connections', query: { returnTo: 'missing_music_decision', returnReleaseId: 'decision-one' } } },
  ]);
  assert.doesNotMatch(JSON.stringify(steps), /private|retry|canSearchAgain/);
  input.decision.decisionId = '//untrusted.invalid';
  assert.deepEqual(build(input)[1].link.to, { name: 'settings-connections' });
});

test('missing, revoked or non-boolean capabilities give escalation guidance and disabled history refuses even forged review flags', () => {
  for (const value of [undefined, null, false, 'true', 1]) {
    const input = detail(); input.permissions = { canReviewIgnoredSources: value, canReviewProviderConnection: value };
    assert.ok(build(input).every(step => step.link === null));
    assert.ok(build(input).every(step => /administrator/.test(step.text)));
  }
  for (const change of [{ isReadOnly: true }, { disabled: true }]) {
    const input = detail();
    if (change.disabled) input.decision.requestedFor.accountStatus = 'disabled';
    else input.permissions.isReadOnly = true;
    assert.deepEqual(build(input).map(step => step.link), [null]);
  }
});

test('unsupported, stale or unrelated evidence does not manufacture a correction destination', () => {
  assert.deepEqual(build({ ...detail(), searchDiagnostics: null }), []);
  assert.deepEqual(build({ ...detail(), searchDiagnostics: { ...counts, responseCount: '2' } }), []);
  assert.deepEqual(build({ ...detail(), searchDiagnostics: { ...counts, ignoredUserResponseCount: 0, malformedFileCount: 0, blacklistedFileCount: 2 } }), []);
  assert.equal(build({ ...detail(), searchDiagnostics: { ...counts, ignoredUserResponseCount: 0 } }).length, 1);
  assert.equal(build({ ...detail(), searchDiagnostics: { ...counts, malformedFileCount: 0 } }).length, 1);
});
