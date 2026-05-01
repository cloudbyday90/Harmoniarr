import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicBrainzImportService } from '../../src/server/metadata/musicbrainz-import-service.js';

function createProviderError() {
  const error = new Error('MusicBrainz lookup failed');
  error.code = 'musicbrainz_unavailable';
  error.details = {
    attempts: 2,
    maxRetries: 1,
    retryAfterMs: 2000,
    retryable: true,
    status: 503,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist/mb-artist-1?fmt=json',
  };
  return error;
}

test('createMusicBrainzImportService imports artists through shared metadata and audit services', async (t) => {
  const lookupArtist = t.mock.fn(async ({ artistId, includeAliases }) => {
    assert.equal(artistId, 'mb-artist-1');
    assert.equal(includeAliases, true);

    return {
      id: 'mb-artist-1',
      name: 'Biosphere',
      'sort-name': 'Biosphere',
      disambiguation: 'Norwegian musician',
      country: 'NO',
      type: 'Person',
      aliases: [{
        name: 'Geir Jenssen',
        locale: null,
        primary: true,
      }],
    };
  });
  const storeArtist = t.mock.fn(async (normalizedArtist) => {
    assert.equal(normalizedArtist.artist.musicbrainzArtistId, 'mb-artist-1');
    assert.equal(normalizedArtist.artist.name, 'Biosphere');
    assert.deepEqual(normalizedArtist.aliases, [{
      alias: 'Geir Jenssen',
      locale: null,
      isPrimary: true,
    }]);
    assert.equal(normalizedArtist.providerSnapshots[0].sourceIdentifier, 'mb-artist-1');

    return {
      id: 'local-artist-1',
      name: normalizedArtist.artist.name,
    };
  });
  const recordAuditEventFn = t.mock.fn(async (event) => event);
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createMusicBrainzImportService({
    metadataService: {
      storeArtist,
    },
    musicBrainzClient: {
      lookupArtist,
    },
    providerHealthRecorder,
    recordAuditEventFn,
  });

  const result = await service.importArtistById({
    artistId: 'mb-artist-1',
    actorUserId: 'user-1',
    requestMetadata: {
      ipAddress: '203.0.113.10',
      userAgent: 'HarmoniarrTest/1.0',
    },
  });

  assert.equal(lookupArtist.mock.callCount(), 1);
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordSuccess.mock.calls[0].arguments, ['musicbrainz']);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 0);
  assert.equal(storeArtist.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'user-1',
    actorType: 'user',
    eventType: 'metadata_musicbrainz_artist_imported',
    summary: 'MusicBrainz artist imported',
    entityType: 'metadata_artist',
    entityId: 'local-artist-1',
    details: {
      sourceProvider: 'musicbrainz',
      musicbrainzArtistId: 'mb-artist-1',
      metadataArtistId: 'local-artist-1',
    },
    ipAddress: '203.0.113.10',
    userAgent: 'HarmoniarrTest/1.0',
  });
  assert.deepEqual(result, {
    artist: {
      id: 'local-artist-1',
      name: 'Biosphere',
    },
    source: {
      provider: 'musicbrainz',
      musicbrainzArtistId: 'mb-artist-1',
    },
  });
});

test('createMusicBrainzImportService preserves provider failures before metadata writes', async (t) => {
  const providerError = createProviderError();
  const lookupArtist = t.mock.fn(async () => {
    throw providerError;
  });
  const storeArtist = t.mock.fn(async () => ({ id: 'local-artist-1' }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createMusicBrainzImportService({
    metadataService: {
      storeArtist,
    },
    musicBrainzClient: {
      lookupArtist,
    },
    providerHealthRecorder,
    recordAuditEventFn,
  });

  await assert.rejects(
    () => service.importArtistById({ artistId: 'mb-artist-1' }),
    (error) => {
      assert.equal(error, providerError);
      assert.equal(error.code, 'musicbrainz_unavailable');
      assert.equal(error.details.throttled, true);
      assert.equal(error.details.retryAfterMs, 2000);
      return true;
    },
  );
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 0);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordError.mock.calls[0].arguments, ['musicbrainz', providerError]);
  assert.equal(lookupArtist.mock.callCount(), 1);
  assert.equal(storeArtist.mock.callCount(), 0);
  assert.equal(recordAuditEventFn.mock.callCount(), 0);
});
