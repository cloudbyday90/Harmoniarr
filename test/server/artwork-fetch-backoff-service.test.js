import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkFetchBackoffService } from '../../src/server/artwork/artwork-fetch-backoff-service.js';

test('artwork fetch backoff starts at one hour and expands to capped delays', async (t) => {
  const storedFailures = new Map();
  let nowMs = Date.parse('2026-05-15T12:00:00.000Z');
  const key = 'musicbrainz_artist:artist-1:artist_thumbnail';

  const service = createArtworkFetchBackoffService({
    deleteArtworkFetchFailureFn: t.mock.fn(async ({ artworkRole, ownerId, ownerType }) => {
      const deleted = storedFailures.get(`${ownerType}:${ownerId}:${artworkRole}`) ?? null;
      storedFailures.delete(`${ownerType}:${ownerId}:${artworkRole}`);
      return deleted;
    }),
    getArtworkFetchFailureFn: t.mock.fn(async ({ artworkRole, ownerId, ownerType }) =>
      storedFailures.get(`${ownerType}:${ownerId}:${artworkRole}`) ?? null),
    nowFn: () => nowMs,
    upsertArtworkFetchFailureFn: t.mock.fn(async (failure) => {
      storedFailures.set(`${failure.ownerType}:${failure.ownerId}:${failure.artworkRole}`, failure);
      return failure;
    }),
  });

  const firstFailure = await service.recordFailure({
    artworkRole: 'artist_thumbnail',
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
  });
  assert.equal(firstFailure.failureCount, 1);
  assert.equal(firstFailure.nextRetryAt, '2026-05-15T13:00:00.000Z');

  nowMs = Date.parse('2026-05-15T13:05:00.000Z');
  const secondFailure = await service.recordFailure({
    artworkRole: 'artist_thumbnail',
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
  });
  assert.equal(secondFailure.failureCount, 2);
  assert.equal(secondFailure.nextRetryAt, '2026-05-15T17:05:00.000Z');

  nowMs = Date.parse('2026-05-15T17:10:00.000Z');
  const thirdFailure = await service.recordFailure({
    artworkRole: 'artist_thumbnail',
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
  });
  assert.equal(thirdFailure.failureCount, 3);
  assert.equal(thirdFailure.nextRetryAt, '2026-05-16T17:10:00.000Z');

  nowMs = Date.parse('2026-05-16T17:15:00.000Z');
  const fourthFailure = await service.recordFailure({
    artworkRole: 'artist_thumbnail',
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
  });
  assert.equal(fourthFailure.failureCount, 4);
  assert.equal(fourthFailure.nextRetryAt, '2026-05-17T17:15:00.000Z');

  const activeBackoff = await service.shouldBackoff({
    artworkRole: 'artist_thumbnail',
    ownerId: 'artist-1',
    ownerType: 'musicbrainz_artist',
  });
  assert.equal(activeBackoff.active, true);
  assert.equal(activeBackoff.retryAfterAt, '2026-05-17T17:15:00.000Z');
  assert.equal(storedFailures.has(key), true);
});

test('artwork fetch backoff clears on success and expires once nextRetryAt passes', async () => {
  let failure = {
    artworkRole: 'cover_front',
    failureCount: 1,
    nextRetryAt: '2026-05-15T13:00:00.000Z',
    ownerId: 'release-1',
    ownerType: 'musicbrainz_release_group',
  };
  let nowMs = Date.parse('2026-05-15T12:30:00.000Z');

  const service = createArtworkFetchBackoffService({
    deleteArtworkFetchFailureFn: async () => {
      const deleted = failure;
      failure = null;
      return deleted;
    },
    getArtworkFetchFailureFn: async () => failure,
    nowFn: () => nowMs,
    upsertArtworkFetchFailureFn: async (nextFailure) => nextFailure,
  });

  const blocked = await service.shouldBackoff({
    artworkRole: 'cover_front',
    ownerId: 'release-1',
    ownerType: 'musicbrainz_release_group',
  });
  assert.equal(blocked.active, true);

  nowMs = Date.parse('2026-05-15T13:05:00.000Z');
  const expired = await service.shouldBackoff({
    artworkRole: 'cover_front',
    ownerId: 'release-1',
    ownerType: 'musicbrainz_release_group',
  });
  assert.equal(expired.active, false);

  await service.clearFailure({
    artworkRole: 'cover_front',
    ownerId: 'release-1',
    ownerType: 'musicbrainz_release_group',
  });
  assert.equal(failure, null);
});
