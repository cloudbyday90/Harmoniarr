import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';
import { basename, extname, posix } from 'node:path';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';

const runId = '33333333-3333-4333-8333-333333333333';
const libraryRootId = '44444444-4444-4444-8444-444444444444';
const context = { runId, libraryRootId, libraryRootPath: '/data/music', requestedLibraryRoot: '/data/music',
  expectedLease: createOperationRunLeaseFixture({ runId, jobType: 'library_scan' }) };
function source(file) {
  return { sizeBytes: 123, modifiedAt: null, filename: basename(file.canonicalPath),
    relativePath: posix.relative(context.libraryRootPath, file.canonicalPath), extension: extname(file.canonicalPath), ...file };
}
const extractTags = (service, { files }) => service.extractLibraryFileTags({ ...context, files: files.map(source) });

test('tag extraction requires its owner and propagates one refused write without failed fallback or artwork', async () => {
  assert.throws(() => createLibraryTagExtractionService({}), /guarded snapshot owner/u);
  for (const code of ['operation_run_lease_lost', 'library_tag_snapshot_stale', 'database_fault']) {
    const error = Object.assign(new Error(code), { code });
    const writes = []; const artwork = [];
    const service = createLibraryTagExtractionService({ extractMetadata: async () => ({ common: {}, native: {}, format: {} }),
      writeOwnedLibraryFileTagSnapshot: async (input) => { writes.push(input); throw error; },
      libraryEmbeddedArtworkService: { captureEmbeddedArtwork: async (input) => { artwork.push(input); } } });
    await assert.rejects(extractTags(service, { files: [{ id: '11111111-1111-4111-8111-111111111111',
      canonicalPath: '/data/music/track.flac', fileState: 'observed' }] }), (caught) => caught === error);
    assert.equal(writes.length, 1); assert.equal(writes[0].payload.status, 'extracted'); assert.equal(artwork.length, 0);
  }
});

test('tag extraction freezes every original source and presentation before the first parser await', async () => {
  const modifiedAt = new Date('2026-04-30T18:00:00.000Z');
  const second = source({ id: '22222222-2222-4222-8222-222222222222', canonicalPath: '/data/music/second.flac',
    fileState: 'observed', modifiedAt, scopeMetadataReleaseId: 'original-hint' });
  const paths = []; const writes = [];
  const service = createLibraryTagExtractionService({ extractMetadata: async (path) => {
    paths.push(path);
    if (paths.length === 1) {
      second.id = '11111111-1111-4111-8111-111111111111'; second.canonicalPath = '/data/music/changed.flac';
      second.sizeBytes = 999; second.scopeMetadataReleaseId = 'changed-hint'; modifiedAt.setTime(0);
      await Promise.resolve();
    }
    return { common: {}, native: {}, format: {} };
  }, writeOwnedLibraryFileTagSnapshot: async (input) => { writes.push(input); } });
  const result = await service.extractLibraryFileTags({ ...context, files: [source({
    id: '11111111-1111-4111-8111-111111111111', canonicalPath: '/data/music/first.flac', fileState: 'observed' }), second] });
  assert.deepEqual(paths, ['/data/music/first.flac', '/data/music/second.flac']);
  assert.equal(writes[1].prepared.file.id, '22222222-2222-4222-8222-222222222222');
  assert.equal(writes[1].prepared.file.modifiedAt, '2026-04-30T18:00:00.000Z');
  assert.equal(writes[1].prepared.file.sizeBytes, 123); assert.ok(Object.isFrozen(writes[1].prepared.file));
  assert.equal(result.files[1].scopeMetadataReleaseId, 'original-hint');
});

test('typed parser and post-commit artwork refusals escape without a failed snapshot', async () => {
  for (const boundary of ['parser', 'artwork']) {
    const error = Object.assign(new Error('Owned operation paused'), { code: 'operation_run_paused' });
    const writes = [];
    const service = createLibraryTagExtractionService({
      extractMetadata: async () => { if (boundary === 'parser') throw error; return { common: {}, native: {}, format: {} }; },
      writeOwnedLibraryFileTagSnapshot: async (input) => { writes.push(input); },
      libraryEmbeddedArtworkService: { captureEmbeddedArtwork: async () => { throw error; } },
    });
    await assert.rejects(extractTags(service, { files: [{ id: '11111111-1111-4111-8111-111111111111',
      canonicalPath: '/data/music/track.flac', fileState: 'observed' }] }), (caught) => caught === error);
    assert.equal(writes.length, boundary === 'parser' ? 0 : 1);
    assert.ok(writes.every((input) => input.payload.status === 'extracted'));
  }
});

test('extractLibraryFileTags parses observed files sequentially and persists normalized snapshots', async (t) => {
  const metadataByPath = new Map();
  const captureEmbeddedArtwork = t.mock.fn(async () => {});
  const writeOwnedLibraryFileTagSnapshot = t.mock.fn(async () => {});
  const extractMetadata = t.mock.fn(async (filePath) => ({
    common: {
      album: 'Amber',
      albumartist: 'Autechre',
      artist: 'Autechre',
      artists: ['Autechre'],
      disk: { no: 1, of: 1 },
      picture: [{ format: 'image/jpeg' }],
      title: filePath.includes('track-01') ? 'Foil' : 'Montreal',
      track: { no: filePath.includes('track-01') ? 1 : 2, of: 11 },
      year: 1994,
    },
    format: {
      bitrate: 932000,
      bitsPerSample: 16,
      codec: 'FLAC',
      duration: 183.412,
      numberOfChannels: 2,
      sampleRate: 44100,
      tagTypes: ['vorbis'],
    },
    native: {
      vorbis: [{
        id: 'TITLE',
        value: filePath.includes('track-01') ? 'Foil' : 'Montreal',
      }],
    },
  }));
  extractMetadata.mock.mockImplementation(async (filePath) => {
    const metadata = {
      common: {
        album: 'Amber',
        albumartist: 'Autechre',
        artist: 'Autechre',
        artists: ['Autechre'],
        disk: { no: 1, of: 1 },
        picture: [{ format: 'image/jpeg' }],
        title: filePath.includes('track-01') ? 'Foil' : 'Montreal',
        track: { no: filePath.includes('track-01') ? 1 : 2, of: 11 },
        year: 1994,
      },
      format: {
        bitrate: 932000,
        bitsPerSample: 16,
        codec: 'FLAC',
        duration: 183.412,
        numberOfChannels: 2,
        sampleRate: 44100,
        tagTypes: ['vorbis'],
      },
      native: {
        vorbis: [{
          id: 'TITLE',
          value: filePath.includes('track-01') ? 'Foil' : 'Montreal',
        }],
      },
    };
    metadataByPath.set(filePath, metadata);
    return metadata;
  });
  const service = createLibraryTagExtractionService({
    extractMetadata,
    libraryEmbeddedArtworkService: { captureEmbeddedArtwork },
    writeOwnedLibraryFileTagSnapshot,
  });

  const result = await extractTags(service, {
    files: [
      {
        canonicalPath: '/data/music/Artist/cover.jpg',
        fileState: 'ignored',
        id: 'file-cover',
      },
      {
        canonicalPath: '/data/music/Artist/track-01.flac',
        fileState: 'observed',
        id: '11111111-1111-4111-8111-111111111111',
        modifiedAt: '2026-04-30T18:00:00.000Z',
        sizeBytes: 123,
      },
      {
        canonicalPath: '/data/music/Artist/track-02.flac',
        fileState: 'observed',
        id: '22222222-2222-4222-8222-222222222222',
        modifiedAt: '2026-04-30T18:01:00.000Z',
        sizeBytes: 456,
      },
    ],
  });

  assert.deepEqual(
    extractMetadata.mock.calls.map((call) => call.arguments[0]),
    [
      '/data/music/Artist/track-01.flac',
      '/data/music/Artist/track-02.flac',
    ],
  );
  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.callCount(), 2);
  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.calls[0].arguments[0].prepared.file.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.calls[0].arguments[0].prepared.file.sizeBytes, 123);
  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.calls[0].arguments[0].prepared.file.modifiedAt, '2026-04-30T18:00:00.000Z');
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 2);
  assert.deepEqual(result.files.map((file) => ({
    id: file.id,
    tagPayload: file.tagPayload,
  })), [
    {
      id: '11111111-1111-4111-8111-111111111111',
      tagPayload: {
        album: 'Amber',
        albumArtist: 'Autechre',
        artist: 'Autechre',
        artists: ['Autechre'],
        disk: { number: 1, of: 1 },
        genre: [],
        musicBrainz: {
          albumArtistId: null,
          artistId: null,
          recordingId: null,
          releaseGroupId: null,
          releaseId: null,
          trackId: null,
        },
        title: 'Foil',
        track: { number: 1, of: 11 },
        year: 1994,
      },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      tagPayload: {
        album: 'Amber',
        albumArtist: 'Autechre',
        artist: 'Autechre',
        artists: ['Autechre'],
        disk: { number: 1, of: 1 },
        genre: [],
        musicBrainz: {
          albumArtistId: null,
          artistId: null,
          recordingId: null,
          releaseGroupId: null,
          releaseId: null,
          trackId: null,
        },
        title: 'Montreal',
        track: { number: 2, of: 11 },
        year: 1994,
      },
    },
  ]);
  assert.deepEqual(captureEmbeddedArtwork.mock.calls[0].arguments[0], {
    libraryFileId: '11111111-1111-4111-8111-111111111111',
    metadata: metadataByPath.get('/data/music/Artist/track-01.flac'),
  });
  assert.deepEqual(writeOwnedLibraryFileTagSnapshot.mock.calls[0].arguments[0].payload, {
    audioCodec: 'FLAC',
    bitrateKbps: 932,
    bitDepth: 16,
    channels: 2,
    durationMs: 183412,
    embeddedArtworkCount: 1,
    extractor: 'music-metadata',
    extractorVersion: null,
    normalizedTags: {
      album: 'Amber',
      albumArtist: 'Autechre',
      artist: 'Autechre',
      artists: ['Autechre'],
      disk: { number: 1, of: 1 },
      genre: [],
      musicBrainz: {
        albumArtistId: null,
        artistId: null,
        recordingId: null,
        releaseGroupId: null,
        releaseId: null,
        trackId: null,
      },
      title: 'Foil',
      track: { number: 1, of: 11 },
      year: 1994,
    },
    rawTags: {
      native: {
        vorbis: [{ id: 'TITLE', value: 'Foil' }],
      },
      tagTypes: ['vorbis'],
    },
    sampleRateHz: 44100,
    status: 'extracted',
    tagFormat: 'vorbis',
  });
});

test('extractLibraryFileTags records failed extraction attempts without throwing', async (t) => {
  const writeOwnedLibraryFileTagSnapshot = t.mock.fn(async () => {});
  const service = createLibraryTagExtractionService({
    extractMetadata: async () => {
      throw new Error('unsupported file content');
    },
    writeOwnedLibraryFileTagSnapshot,
  });

  const result = await extractTags(service, {
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
    }],
  });

  assert.deepEqual(writeOwnedLibraryFileTagSnapshot.mock.calls[0].arguments[0].payload, {
    extractor: 'music-metadata',
    extractorVersion: null,
    rawTags: {
      error: 'unsupported file content',
    },
    status: 'failed',
  });
  assert.deepEqual(result.files.map(({ canonicalPath, fileState, id, tagPayload }) => ({ canonicalPath, fileState, id, tagPayload })), [{
    canonicalPath: '/data/music/Artist/track-01.flac',
    fileState: 'observed',
    id: '11111111-1111-4111-8111-111111111111',
    tagPayload: null,
  }]);
});

test('extractLibraryFileTags treats embedded artwork capture as best effort after snapshot persistence', async (t) => {
  const writeOwnedLibraryFileTagSnapshot = t.mock.fn(async () => {});
  const captureEmbeddedArtwork = t.mock.fn(async () => {
    throw new Error('invalid embedded artwork');
  });
  const service = createLibraryTagExtractionService({
    extractMetadata: async () => ({
      common: {
        picture: [{ data: Buffer.from('cover'), format: 'image/jpeg' }],
      },
      format: {
        tagTypes: ['id3v2.4'],
      },
      native: {},
    }),
    libraryEmbeddedArtworkService: { captureEmbeddedArtwork },
    writeOwnedLibraryFileTagSnapshot,
  });

  await extractTags(service, {
    files: [{
      canonicalPath: '/data/music/Artist/track-01.mp3',
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
    }],
  });

  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.callCount(), 1);
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 1);
});

test('extractLibraryFileTags still invokes the shared embedded artwork reconciler when pictures are absent', async (t) => {
  const writeOwnedLibraryFileTagSnapshot = t.mock.fn(async () => {});
  const captureEmbeddedArtwork = t.mock.fn(async () => null);
  const service = createLibraryTagExtractionService({
    extractMetadata: async () => ({
      common: {
        picture: [],
      },
      format: {
        tagTypes: ['id3v2.4'],
      },
      native: {},
    }),
    libraryEmbeddedArtworkService: { captureEmbeddedArtwork },
    writeOwnedLibraryFileTagSnapshot,
  });

  await extractTags(service, {
    files: [{
      canonicalPath: '/data/music/Artist/track-02.mp3',
      fileState: 'observed',
      id: '22222222-2222-4222-8222-222222222222',
    }],
  });

  assert.equal(writeOwnedLibraryFileTagSnapshot.mock.callCount(), 1);
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 1);
  assert.deepEqual(captureEmbeddedArtwork.mock.calls[0].arguments[0], {
    libraryFileId: '22222222-2222-4222-8222-222222222222',
    metadata: {
      common: {
        picture: [],
      },
      format: {
        tagTypes: ['id3v2.4'],
      },
      native: {},
    },
  });
});
