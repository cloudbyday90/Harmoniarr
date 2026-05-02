import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryNamingService } from '../../src/server/library/library-naming-service.js';

test('createLibraryNamingService sanitizes cross-platform path segments and reserved filenames', () => {
  const service = createLibraryNamingService();

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

test('createLibraryNamingService builds default album and track names from the planning templates', () => {
  const service = createLibraryNamingService();

  assert.equal(
    service.buildArtistFolderName({ artistName: 'Autechre' }),
    'Autechre',
  );
  assert.equal(
    service.buildAlbumFolderName({
      albumTitle: 'Amber',
      releaseDate: '1994-08-22',
    }),
    'Amber (1994)',
  );
  assert.equal(
    service.buildTrackFilename({
      extension: 'flac',
      isMultiDisc: false,
      trackNumber: 1,
      trackTitle: 'Foil',
    }),
    '01 - Foil.flac',
  );
  assert.equal(
    service.buildTrackFilename({
      discNumber: 2,
      extension: '.flac',
      isMultiDisc: true,
      trackNumber: 3,
      trackTitle: 'Clip-Hope / Mix',
    }),
    '2-03 - Clip-Hope - Mix.flac',
  );
});
