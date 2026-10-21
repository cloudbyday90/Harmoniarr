import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIgnoredSourceReviewLocation as build, resolveIgnoredSourceReviewReturn as resolve } from '../../src/client/lib/ignored-source-review-handoff.js';

const query = { returnTo: 'missing_music_decision', returnReleaseId: 'release-123' };
test('bounded origin round-trips to a fixed decision route without accepting query authority or URLs', () => {
  assert.deepEqual(build('release-123'), { name: 'activity-ignored', query });
  assert.deepEqual(resolve({ actorRole: 'admin', query: { ...query, url: 'https://untrusted.invalid', role: 'admin', userId: 'other', searchAgain: 'true' } }), {
    name: 'missing-decision', params: { decisionId: 'release-123' },
  });
  const max = 'a'.repeat(128);
  assert.deepEqual(resolve({ actorRole: 'admin', query: build(max).query }).params, { decisionId: max });
});
test('invalid, repeated and unrelated contexts cannot manufacture a return destination', () => {
  for (const value of ['', null, undefined, [], ['release-123'], 'a'.repeat(129), 'https://untrusted.invalid', '//untrusted.invalid', '../release', 'a/b', 'a?next=foo', 'a#foo', '%2fadmin']) {
    assert.equal(resolve({ actorRole: 'admin', query: { ...query, returnReleaseId: value } }), null);
    if (!Array.isArray(value)) assert.deepEqual(build(value), { name: 'activity-ignored' });
  }
  for (const returnTo of [undefined, null, ['missing_music_decision'], 'https://untrusted.invalid', 'dashboard', 'missing_music', 'music_queue_release', '__proto__']) {
    assert.equal(resolve({ actorRole: 'admin', query: { ...query, returnTo, repair: 'missing_music_decision' } }), null);
  }
});
test('query context is never administrator authority and role withdrawal immediately removes return navigation', () => {
  for (const actorRole of [undefined, null, 'requester', 'operator', 'ADMIN', true]) {
    assert.equal(resolve({ actorRole, query }), null);
  }
  assert.equal(resolve({ actorRole: 'admin', query: {} }), null);
  assert.equal(resolve(), null);
});
