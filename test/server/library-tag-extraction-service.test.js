import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';

test('extractLibraryFileTags parses observed files sequentially and persists normalized snapshots', async (t) => {
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
  const service = createLibraryTagExtractionService({
    extractMetadata,
    libraryTagSnapshotStore: { writeLibraryFileTagSnapshot },
  });

  await service.extractLibraryFileTags({
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
      },
      {
        canonicalPath: '/data/music/Artist/track-02.flac',
        fileState: 'observed',
        id: 'file-2',
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

  await service.extractLibraryFileTags({
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
});