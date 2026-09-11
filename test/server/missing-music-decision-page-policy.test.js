import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertMissingMusicCursorPagination, buildMissingMusicCursorContext,
  decodeMissingMusicCursor, encodeMissingMusicCursor, normalizeMissingMusicPageLimit,
} from '../../src/server/missing-music/missing-music-decision-page-policy.js';

const row = { createdAtKey: '2026-09-11T12:30:45.123456Z', id: '11111111-1111-4111-8111-111111111111' };
const filter = { actorUserId: 'actor', accountStatus: 'active', limit: 50, scope: 'mine', search: 'Album', state: 'action', targetUserIds: ['actor'] };
const context = buildMissingMusicCursorContext(filter);

test('Missing Music cursors retain all six fractional timestamp digits and normalized filter context', () => {
  const cursor = encodeMissingMusicCursor(row, context);
  assert.deepEqual(decodeMissingMusicCursor(cursor, context), row);
  assert.equal(buildMissingMusicCursorContext({ ...filter, search: 'album' }), context);
  assert.equal(decodeMissingMusicCursor(null, context), null);
});

test('Missing Music cursors reject changed actor, scope, account, search, state, page size, and eligible users', () => {
  const cursor = encodeMissingMusicCursor(row, context);
  for (const change of [
    { actorUserId: 'other' }, { scope: 'all' }, { accountStatus: 'disabled' },
    { search: 'Other' }, { state: 'all' }, { limit: 100 }, { targetUserIds: ['other'] },
  ]) {
    assert.throws(() => decodeMissingMusicCursor(cursor, buildMissingMusicCursorContext({ ...filter, ...change })),
      { code: 'missing_music_cursor_invalid', status: 400 });
  }
});

test('Missing Music cursor validation rejects malformed and oversized data before SQL', () => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const valid = { v: 1, f: context, c: row.createdAtKey, i: row.id };
  for (const cursor of [
    {}, ['cursor'], 'x'.repeat(1025), 'not-json', `${encode(valid)}=`,
    encode({ ...valid, v: 2 }), encode({ ...valid, c: '2026-02-31T12:30:45.123456Z' }),
    encode({ ...valid, c: '0000-01-01T12:30:45.123456Z' }),
    encode({ ...valid, c: '2026-09-11T12:30:45.123Z' }), encode({ ...valid, i: '1 OR 1=1' }),
    encode({ ...valid, extra: true }), encode([]), encode(null),
  ]) assert.throws(() => decodeMissingMusicCursor(cursor, context), { code: 'missing_music_cursor_invalid', status: 400 });
});

test('Missing Music bounds page size and rejects nonzero offset traversal', () => {
  assert.equal(normalizeMissingMusicPageLimit(), 50);
  assert.equal(normalizeMissingMusicPageLimit(500), 100);
  assert.equal(normalizeMissingMusicPageLimit(0), 1);
  assertMissingMusicCursorPagination(0);
  assertMissingMusicCursorPagination(undefined);
  assert.throws(() => assertMissingMusicCursorPagination(1), { status: 400 });
});
