import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryOrganizePreviewService } from '../../src/server/library/library-organize-preview-service.js';

test('buildLibraryOrganizePreview reports rename-required, canonical, and unmatched files', async () => {
  const service = createLibraryOrganizePreviewService({
    libraryOrganizePreviewStore: {
      listLibraryFilesForOrganizePreview: async () => ([
        {
          artistName: 'Autechre',
          canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
          extension: '.flac',
          filename: '01 Foil.flac',
          id: 'file-1',
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
        },
        {
          artistName: 'Autechre',
          canonicalPath: '/music/Autechre/Amber (1994)/02 - Montreal.flac',
          extension: '.flac',
          filename: '02 - Montreal.flac',
          id: 'file-2',
          libraryRootPath: '/music',
          matchStatus: 'matched',
          matchedBy: 'musicbrainz_recording_id',
          mediumCount: 1,
          mediumPosition: 1,
          metadataReleaseId: 'release-1',
          metadataTrackId: 'track-2',
          relativePath: 'Autechre/Amber (1994)/02 - Montreal.flac',
          releaseDate: '1994-08-22',
          releaseGroupTitle: 'Amber',
          releaseTitle: 'Amber',
          trackPosition: 2,
          trackTitle: 'Montreal',
        },
        {
          artistName: null,
          canonicalPath: '/music/Unknown/03 Mystery.flac',
          extension: '.flac',
          filename: '03 Mystery.flac',
          id: 'file-3',
          libraryRootPath: '/music',
          matchStatus: 'unmatched',
          matchedBy: 'missing_tag_payload',
          mediumCount: 0,
          mediumPosition: 0,
          metadataReleaseId: null,
          metadataTrackId: null,
          relativePath: 'Unknown/03 Mystery.flac',
          releaseDate: null,
          releaseGroupTitle: null,
          releaseTitle: null,
          trackPosition: 0,
          trackTitle: null,
        },
      ]),
    },
  });

  const preview = await service.buildLibraryOrganizePreview();

  assert.equal(preview.summary.status, 'attention');
  assert.equal(preview.summary.message, '1 library file can be reorganized now, but 1 still need match or collision review first.');
  assert.deepEqual(preview.counts, {
    alreadyCanonicalCount: 1,
    blockedAmbiguousCount: 0,
    blockedCount: 1,
    blockedDuplicateTargetCount: 0,
    blockedMissingMetadataCount: 0,
    blockedOutsideRootCount: 0,
    blockedUnmatchedCount: 1,
    blockedUnsupportedExtensionCount: 0,
    matchedFiles: 2,
    renameRequiredCount: 1,
    totalFiles: 3,
  });
  assert.equal(preview.files[0].status.code, 'rename_required');
  assert.equal(preview.files[0].proposedRelativePath, 'Autechre/Amber (1994)/01 - Foil.flac');
  assert.equal(preview.files[1].status.code, 'already_canonical');
  assert.equal(preview.files[2].status.code, 'blocked_unmatched');
});

test('buildLibraryOrganizePreview blocks duplicate canonical targets before apply exists', async () => {
  const service = createLibraryOrganizePreviewService({
    libraryOrganizePreviewStore: {
      listLibraryFilesForOrganizePreview: async () => ([
        {
          artistName: 'Autechre',
          canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
          extension: '.flac',
          filename: '01 Foil.flac',
          id: 'file-1',
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
        },
        {
          artistName: 'Autechre',
          canonicalPath: '/music/Autechre/Amber/foil-copy.flac',
          extension: '.flac',
          filename: 'foil-copy.flac',
          id: 'file-2',
          libraryRootPath: '/music',
          matchStatus: 'matched',
          matchedBy: 'musicbrainz_release_title_track_position',
          mediumCount: 1,
          mediumPosition: 1,
          metadataReleaseId: 'release-1',
          metadataTrackId: 'track-1',
          relativePath: 'Autechre/Amber/foil-copy.flac',
          releaseDate: '1994-08-22',
          releaseGroupTitle: 'Amber',
          releaseTitle: 'Amber',
          trackPosition: 1,
          trackTitle: 'Foil',
        },
      ]),
    },
  });

  const preview = await service.buildLibraryOrganizePreview();

  assert.equal(preview.summary.status, 'attention');
  assert.equal(preview.counts.renameRequiredCount, 0);
  assert.equal(preview.counts.blockedDuplicateTargetCount, 2);
  assert.equal(preview.files[0].status.code, 'blocked_duplicate_target');
  assert.equal(preview.files[1].status.code, 'blocked_duplicate_target');
});

test('buildLibraryOrganizePreview reports empty state when no observed files are available', async () => {
  const service = createLibraryOrganizePreviewService({
    libraryOrganizePreviewStore: {
      listLibraryFilesForOrganizePreview: async () => [],
    },
  });

  const preview = await service.buildLibraryOrganizePreview();

  assert.equal(preview.summary.status, 'empty');
  assert.equal(preview.summary.message, 'No observed library files are available for organize preview yet.');
  assert.equal(preview.counts.totalFiles, 0);
});
