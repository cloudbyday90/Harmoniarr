import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';

test('extractLibraryFileTags parses observed files sequentially and persists normalized snapshots', async (t) => {
  const metadataByPath = new Map();
  const captureEmbeddedArtwork = t.mock.fn(async () => {});
  const writeLibraryFileTagSnapshot = t.mock.fn(async () => {});
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
    libraryTagSnapshotStore: { writeLibraryFileTagSnapshot },
  });

  const result = await service.extractLibraryFileTags({
    files: [
      {
        canonicalPath: '/data/music/Artist/cover.jpg',
        fileState: 'ignored',
        id: 'file-cover',
      },
      {
        canonicalPath: '/data/music/Artist/track-01.flac',
        fileState: 'observed',
        id: 'file-1',
        modifiedAt: '2026-04-30T18:00:00.000Z',
        sizeBytes: 123,
      },
      {
        canonicalPath: '/data/music/Artist/track-02.flac',
        fileState: 'observed',
        id: 'file-2',
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
  assert.equal(writeLibraryFileTagSnapshot.mock.callCount(), 2);
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 2);
  assert.deepEqual(result.files.map((file) => ({
    id: file.id,
    tagPayload: file.tagPayload,
  })), [
    {
      id: 'file-1',
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
      id: 'file-2',
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
    libraryFileId: 'file-1',
    metadata: metadataByPath.get('/data/music/Artist/track-01.flac'),
  });
  assert.deepEqual(writeLibraryFileTagSnapshot.mock.calls[0].arguments[0], {
    audioCodec: 'FLAC',
    bitrateKbps: 932,
    bitDepth: 16,
    channels: 2,
    durationMs: 183412,
    embeddedArtworkCount: 1,
    extractor: 'music-metadata',
    extractorVersion: null,
    libraryFileId: 'file-1',
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
    sourceModifiedAt: '2026-04-30T18:00:00.000Z',
    sourceSizeBytes: 123,
    status: 'extracted',
    tagFormat: 'vorbis',
  });
});

test('extractLibraryFileTags records failed extraction attempts without throwing', async (t) => {
  const writeLibraryFileTagSnapshot = t.mock.fn(async () => {});
  const service = createLibraryTagExtractionService({
    extractMetadata: async () => {
      throw new Error('unsupported file content');
    },
    libraryTagSnapshotStore: { writeLibraryFileTagSnapshot },
  });

  const result = await service.extractLibraryFileTags({
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      fileState: 'observed',
      id: 'file-1',
    }],
  });

  assert.deepEqual(writeLibraryFileTagSnapshot.mock.calls[0].arguments[0], {
    extractor: 'music-metadata',
    extractorVersion: null,
    libraryFileId: 'file-1',
    rawTags: {
      error: 'unsupported file content',
    },
    status: 'failed',
  });
  assert.deepEqual(result.files, [{
    canonicalPath: '/data/music/Artist/track-01.flac',
    fileState: 'observed',
    id: 'file-1',
    tagPayload: null,
  }]);
});

test('extractLibraryFileTags treats embedded artwork capture as best effort after snapshot persistence', async (t) => {
  const writeLibraryFileTagSnapshot = t.mock.fn(async () => {});
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
    libraryTagSnapshotStore: { writeLibraryFileTagSnapshot },
  });

  await service.extractLibraryFileTags({
    files: [{
      canonicalPath: '/data/music/Artist/track-01.mp3',
      fileState: 'observed',
      id: 'file-1',
    }],
  });

  assert.equal(writeLibraryFileTagSnapshot.mock.callCount(), 1);
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 1);
});

test('extractLibraryFileTags still invokes the shared embedded artwork reconciler when pictures are absent', async (t) => {
  const writeLibraryFileTagSnapshot = t.mock.fn(async () => {});
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
    libraryTagSnapshotStore: { writeLibraryFileTagSnapshot },
  });

  await service.extractLibraryFileTags({
    files: [{
      canonicalPath: '/data/music/Artist/track-02.mp3',
      fileState: 'observed',
      id: 'file-2',
    }],
  });

  assert.equal(writeLibraryFileTagSnapshot.mock.callCount(), 1);
  assert.equal(captureEmbeddedArtwork.mock.callCount(), 1);
  assert.deepEqual(captureEmbeddedArtwork.mock.calls[0].arguments[0], {
    libraryFileId: 'file-2',
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
