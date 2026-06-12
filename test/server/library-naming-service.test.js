import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NAMING_TEMPLATES } from '../../src/server/library/library-naming-template-engine.js';
import { createLibraryNamingService } from '../../src/server/library/library-naming-service.js';

function createMockLoadSettingsFn(naming = {}) {
  return async () => ({ naming });
}

test('createLibraryNamingService sanitizes cross-platform path segments and reserved filenames', () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    service.sanitizeLibraryPathSegment('  Kid A / Amnesiac  '),
    'Kid A - Amnesiac',
  );
  assert.equal(
    service.sanitizeLibraryFilename('CON?.flac'),
    'CON_.flac',
  );
  assert.equal(
    service.sanitizeLibraryFilename('...?.jpg'),
    'untitled.jpg',
  );
});

test('createLibraryNamingService builds default album and track names from the planning templates', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: 'Autechre' }),
    'Autechre',
  );
  assert.equal(
    await service.buildAlbumFolderName({
      albumTitle: 'Amber',
      releaseDate: '1994-08-22',
    }),
    'Amber (1994)',
  );
  assert.equal(
    await service.buildTrackFilename({
      extension: 'flac',
      isMultiDisc: false,
      trackNumber: 1,
      trackTitle: 'Foil',
    }),
    '01 - Foil.flac',
  );
  assert.equal(
    await service.buildTrackFilename({
      discNumber: 2,
      extension: '.flac',
      isMultiDisc: true,
      trackNumber: 3,
      trackTitle: 'Clip-Hope / Mix',
    }),
    '2-03 - Clip-Hope - Mix.flac',
  );
});

test('createLibraryNamingService falls back to defaults when loadSettingsFn throws', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: async () => { throw new Error('db unavailable'); },
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: 'Radiohead' }),
    'Radiohead',
  );
  assert.equal(
    await service.buildAlbumFolderName({
      albumTitle: 'OK Computer',
      releaseDate: '1997-06-16',
    }),
    'OK Computer (1997)',
  );
  assert.equal(
    await service.buildTrackFilename({
      extension: '.flac',
      isMultiDisc: false,
      trackNumber: 1,
      trackTitle: 'Airbag',
    }),
    '01 - Airbag.flac',
  );
});

test('createLibraryNamingService falls back to defaults when naming namespace is missing', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: async () => ({}),
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: 'Boards of Canada' }),
    'Boards of Canada',
  );
});

test('createLibraryNamingService resolves custom artist folder template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn({
      ...DEFAULT_NAMING_TEMPLATES,
      artistFolderFormat: '{ArtistName} ({ReleaseYear})',
    }),
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: 'Aphex Twin' }),
    'Aphex Twin ()',
  );
});

test('createLibraryNamingService resolves custom album folder template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn({
      ...DEFAULT_NAMING_TEMPLATES,
      albumFolderFormat: '{ReleaseYear} - {AlbumTitle}',
    }),
  });

  assert.equal(
    await service.buildAlbumFolderName({
      albumTitle: 'Selected Ambient Works 85-92',
      releaseDate: '1992-11-09',
    }),
    '1992 - Selected Ambient Works 85-92',
  );
});

test('createLibraryNamingService resolves custom track filename template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn({
      ...DEFAULT_NAMING_TEMPLATES,
      trackFilenameFormat: '{TrackNumber}_{SongTitle}',
    }),
  });

  assert.equal(
    await service.buildTrackFilename({
      extension: '.mp3',
      isMultiDisc: false,
      trackNumber: 7,
      trackTitle: 'Xtal',
    }),
    '07_Xtal.mp3',
  );
});

test('createLibraryNamingService resolves custom multi-disc template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn({
      ...DEFAULT_NAMING_TEMPLATES,
      multiDiscTrackFilenameFormat: 'D{DiscNumber}T{TrackNumber} - {SongTitle}',
    }),
  });

  assert.equal(
    await service.buildTrackFilename({
      discNumber: 1,
      extension: '.flac',
      isMultiDisc: true,
      trackNumber: 4,
      trackTitle: 'Weathercocks',
    }),
    'D1T04 - Weathercocks.flac',
  );
});

test('createLibraryNamingService sanitizes template output for reserved characters', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: 'AC/DC' }),
    'AC - DC',
  );
  assert.equal(
    await service.buildTrackFilename({
      extension: '.flac',
      isMultiDisc: false,
      trackNumber: 1,
      trackTitle: 'What?: "The" <Song>',
    }),
    '01 - What - - The - - Song.flac',
  );
});

test('createLibraryNamingService uses fallback for empty artist name', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    await service.buildArtistFolderName({ artistName: '' }),
    'Unknown Artist',
  );
  assert.equal(
    await service.buildArtistFolderName({ artistName: null }),
    'Unknown Artist',
  );
});

test('createLibraryNamingService produces literal text for empty album title in template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    await service.buildAlbumFolderName({ albumTitle: '', releaseDate: null }),
    '()',
  );
});

test('createLibraryNamingService produces trimmed output for empty track title in template', async () => {
  const service = createLibraryNamingService({
    loadSettingsFn: createMockLoadSettingsFn(),
  });

  assert.equal(
    await service.buildTrackFilename({
      extension: '.flac',
      isMultiDisc: false,
      trackNumber: 1,
      trackTitle: '',
    }),
    '01.flac',
  );
});
