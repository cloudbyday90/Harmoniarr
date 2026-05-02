import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryOrganizePreviewStore } from '../../src/server/library/library-organize-preview-store.js';

test('listLibraryFilesForOrganizePreview returns observed library files with match and metadata context', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      artist_name: 'Autechre',
      canonical_path: '/music/Autechre/Amber/01 Foil.flac',
      extension: '.flac',
      file_state: 'observed',
      filename: '01 Foil.flac',
      library_file_id: 'file-1',
      library_root_canonical_path: '/music',
      library_root_id: 'root-1',
      match_status: 'matched',
      matched_by: 'musicbrainz_recording_id',
      medium_count: 1,
      medium_position: 1,
      metadata_release_id: 'release-1',
      metadata_track_id: 'track-1',
      relative_path: 'Autechre/Amber/01 Foil.flac',
      release_date: '1994-08-22',
      release_group_title: 'Amber',
      release_title: 'Amber',
      track_position: 1,
      track_title: 'Foil',
    }],
  }));
  const store = createLibraryOrganizePreviewStore({
    getPoolFn: () => ({ query }),
  });

  const rows = await store.listLibraryFilesForOrganizePreview();

  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /FROM library_files/);
  assert.deepEqual(rows, [{
    artistName: 'Autechre',
    canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
    extension: '.flac',
    fileState: 'observed',
    filename: '01 Foil.flac',
    id: 'file-1',
    libraryRootId: 'root-1',
    libraryRootPath: '/music',
    matchStatus: 'matched',
    matchedBy: 'musicbrainz_recording_id',
    mediumCount: 1,
    mediumPosition: 1,
    metadataReleaseId: 'release-1',
    metadataTrackId: 'track-1',
    relativePath: 'Autechre/Amber/01 Foil.flac',
    releaseDate: '1994-08-22',
    releaseGroupTitle: 'Amber',
    releaseTitle: 'Amber',
    trackPosition: 1,
    trackTitle: 'Foil',
  }]);
});
