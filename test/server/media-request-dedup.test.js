import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDedupLookupKey, findDuplicateRequest } from '../../src/server/library/media-request-dedup.js';

test('buildDedupLookupKey returns MBID mode when musicbrainzReleaseId is provided', () => {
  const key = buildDedupLookupKey({ musicbrainzReleaseId: 'abc-123', artistName: 'Artist', releaseTitle: 'Title' });
  assert.equal(key.mode, 'mbid');
  assert.equal(key.value, 'abc-123');
});

test('buildDedupLookupKey returns text mode when no musicbrainzReleaseId', () => {
  const key = buildDedupLookupKey({ artistName: 'Daft Punk', releaseTitle: 'Discovery' });
  assert.equal(key.mode, 'text');
  assert.equal(key.value, 'daft punk\0discovery');
});

test('buildDedupLookupKey returns null when no identifying fields', () => {
  assert.equal(buildDedupLookupKey({}), null);
  assert.equal(buildDedupLookupKey({ artistName: '', releaseTitle: '' }), null);
});

test('buildDedupLookupKey trims whitespace from musicbrainzReleaseId', () => {
  const key = buildDedupLookupKey({ musicbrainzReleaseId: '  abc-123  ' });
  assert.equal(key.mode, 'mbid');
  assert.equal(key.value, 'abc-123');
});

test('buildDedupLookupKey ignores empty string musicbrainzReleaseId', () => {
  const key = buildDedupLookupKey({ musicbrainzReleaseId: '', artistName: 'Artist', releaseTitle: 'Title' });
  assert.equal(key.mode, 'text');
});

test('buildDedupLookupKey normalizes text case-insensitively', () => {
  const key = buildDedupLookupKey({ artistName: 'DAFT PUNK', releaseTitle: 'DISCOVERY' });
  assert.equal(key.value, 'daft punk\0discovery');
});

test('findDuplicateRequest matches by musicbrainzReleaseId', () => {
  const activeRequests = [
    {
      id: 'req-1',
      musicbrainzReleaseId: 'mbid-123',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-123',
    artistName: 'Daft Punk',
    releaseTitle: 'Discovery',
    requestedForUserId: 'user-B',
  });

  assert.equal(result.id, 'req-1');
});

test('findDuplicateRequest matches by artist+title text when no MBID', () => {
  const activeRequests = [
    {
      id: 'req-2',
      artistName: 'Daft Punk',
      musicbrainzReleaseId: null,
      releaseTitle: 'Discovery',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    artistName: 'Daft Punk',
    releaseTitle: 'Discovery',
    requestedForUserId: 'user-B',
  });

  assert.equal(result.id, 'req-2');
});

test('findDuplicateRequest returns null when no match', () => {
  const activeRequests = [
    {
      id: 'req-3',
      musicbrainzReleaseId: 'mbid-other',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-123',
    requestedForUserId: 'user-B',
  });

  assert.equal(result, null);
});

test('findDuplicateRequest skips same user requests', () => {
  const activeRequests = [
    {
      id: 'req-4',
      musicbrainzReleaseId: 'mbid-123',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-123',
    requestedForUserId: 'user-A',
  });

  assert.equal(result, null);
});

test('findDuplicateRequest does not fall back to text match when key is MBID mode', () => {
  const activeRequests = [
    {
      id: 'req-5',
      artistName: 'Daft Punk',
      musicbrainzReleaseId: null,
      releaseTitle: 'Discovery',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-not-in-list',
    artistName: 'Daft Punk',
    releaseTitle: 'Discovery',
    requestedForUserId: 'user-B',
  });

  assert.equal(result, null);
});

test('findDuplicateRequest uses existingMatch.musicbrainzReleaseId as fallback', () => {
  const activeRequests = [
    {
      id: 'req-6',
      musicbrainzReleaseId: null,
      existingMatch: { musicbrainzReleaseId: 'mbid-456' },
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-456',
    requestedForUserId: 'user-B',
  });

  assert.equal(result.id, 'req-6');
});

test('findDuplicateRequest is case-insensitive for text matching', () => {
  const activeRequests = [
    {
      id: 'req-7',
      artistName: 'daft punk',
      musicbrainzReleaseId: null,
      releaseTitle: 'discovery',
      requestedForUser: { id: 'user-A' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    artistName: 'DAFT PUNK',
    releaseTitle: 'DISCOVERY',
    requestedForUserId: 'user-B',
  });

  assert.equal(result.id, 'req-7');
});

test('findDuplicateRequest returns null for empty active list', () => {
  const result = findDuplicateRequest({
    activeRequests: [],
    musicbrainzReleaseId: 'mbid-123',
    requestedForUserId: 'user-B',
  });

  assert.equal(result, null);
});

test('findDuplicateRequest returns first matching request', () => {
  const activeRequests = [
    {
      id: 'req-older',
      musicbrainzReleaseId: 'mbid-123',
      requestedForUser: { id: 'user-C' },
      requestState: 'needs_fetch',
    },
    {
      id: 'req-newer',
      musicbrainzReleaseId: 'mbid-123',
      requestedForUser: { id: 'user-D' },
      requestState: 'needs_fetch',
    },
  ];

  const result = findDuplicateRequest({
    activeRequests,
    musicbrainzReleaseId: 'mbid-123',
    requestedForUserId: 'user-B',
  });

  assert.equal(result.id, 'req-older');
});
