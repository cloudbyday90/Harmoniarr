/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createQualityReviewCursorPolicy, qualityReviewCursorContext } from '../../src/server/import-candidates/import-candidate-quality-review-cursor-policy.js';

const anchor = '00000000-0000-4000-8000-000000000001';
test('signed cursors refuse tampering, malformed input, changed context, expiry and another process key', () => {
  let clock = 1000; const policy = createQualityReviewCursorPolicy({ now: () => clock, ttlMs: 100 });
  const cursor = policy.encode({ anchor, direction: 'previous', context: 'scope' });
  assert.deepEqual(policy.decode(cursor, 'scope'), { anchor, direction: 'previous' });
  assert.deepEqual(policy.decode(null, 'scope'), { anchor: null, direction: 'next' });
  for (const value of [[], {}, '', 'x'.repeat(1025), `${cursor}x`, cursor.replace(/^./u, 'x')]) {
    assert.throws(() => policy.decode(value, 'scope'), error => error.status === 409 && error.code === 'missing_music_match_page_changed');
  }
  assert.throws(() => policy.decode(cursor, 'other-scope'));
  assert.throws(() => createQualityReviewCursorPolicy().decode(cursor, 'scope'));
  clock = 1100; assert.throws(() => policy.decode(cursor, 'scope'));
});

test('the context binds actor, target, failed search, participants and current effective policy', () => {
  const input = { actorUserId: 'actor', actorRole: 'admin', appUserId: 'owner', wantedReleaseId: 'wanted' };
  const scope = { failedCandidate: { id: 'failed', sourceSearchId: 'search' }, wantedReleaseIds: ['wanted'],
    requiredContext: { profileCode: 'lossless_archive' }, participants: [{ wantedReleaseId: 'wanted', appUserId: 'owner', isDisabled: false }] };
  const original = qualityReviewCursorContext(input, scope);
  for (const field of Object.keys(input)) assert.notEqual(qualityReviewCursorContext({ ...input, [field]: 'changed' }, scope), original);
  for (const mutate of [s => { s.failedCandidate.id = 'new'; }, s => { s.failedCandidate.sourceSearchId = 'new'; },
    s => { s.requiredContext.profileCode = 'any_available'; }, s => { s.participants[0].isDisabled = true; },
    s => { s.wantedReleaseIds.push('another'); }]) {
    const changed = structuredClone(scope); mutate(changed); assert.notEqual(qualityReviewCursorContext(input, changed), original);
  }
  assert.doesNotMatch(original, /actor|owner|search|lossless/u);
});
