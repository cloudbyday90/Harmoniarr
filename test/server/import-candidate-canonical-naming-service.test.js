import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateCanonicalNamingService } from '../../src/server/import-candidates/import-candidate-canonical-naming-service.js';

function createMetadataFixtures() {
  return {
    artist: {
      id: 'artist-1',
      name: 'Autechre',
    },
    mediaRows: [{
      id: 'medium-1',
      position: 1,
    }],
    release: {
      id: 'release-1',
      metadata_release_group_id: 'release-group-1',
      release_date: '1994-08-22',
      title: 'Amber',
    },
    releaseGroup: {
      id: 'release-group-1',
      first_release_date: '1994-01-01',
      metadata_artist_id: 'artist-1',
      title: 'Amber',
    },
    trackRows: [{
      id: 'track-1',
      metadata_medium_id: 'medium-1',
      position: 1,
      title: 'Foil',
    }],
  };
}

test('createImportCandidateCanonicalNamingService builds canonical album and track names for discovery-linked candidates', async () => {
  const fixtures = createMetadataFixtures();
  const service = createImportCandidateCanonicalNamingService({
    findMetadataReleaseIdBySearchId: async ({ searchId }) => {
      assert.equal(searchId, 'search-1');
      return 'release-1';
    },
    getMetadataArtistByIdFn: async () => fixtures.artist,
    getMetadataReleaseByIdFn: async () => fixtures.release,
    getMetadataReleaseGroupByIdFn: async () => fixtures.releaseGroup,
    listMetadataMediaByReleaseIdFn: async () => fixtures.mediaRows,
    listMetadataTracksByReleaseIdFn: async () => fixtures.trackRows,
  });

  const namingPlan = await service.resolveCanonicalImportNaming({
    candidate: {
      id: 'candidate-1',
      sourceSearchId: 'search-1',
      files: [{
        id: 'file-1',
        extension: 'flac',
        filename: '01 Foil.flac',
        sourceFileIndex: 0,
      }],
    },
  });

  assert.equal(namingPlan.canApply, true);
  assert.equal(namingPlan.relativeFolderPath, 'Autechre/Amber (1994)');
  assert.equal(namingPlan.strategy, 'canonical_release_default_template');
  assert.deepEqual(
    Array.from(namingPlan.fileNamesById.entries()),
    [['file-1', '01 - Foil.flac']],
  );
});

test('createImportCandidateCanonicalNamingService keeps canonical track naming for audio files while mirroring extras', async () => {
  const fixtures = createMetadataFixtures();
  const service = createImportCandidateCanonicalNamingService({
    findMetadataReleaseIdBySearchId: async () => 'release-1',
    getMetadataArtistByIdFn: async () => fixtures.artist,
    getMetadataReleaseByIdFn: async () => fixtures.release,
    getMetadataReleaseGroupByIdFn: async () => fixtures.releaseGroup,
    listMetadataMediaByReleaseIdFn: async () => fixtures.mediaRows,
    listMetadataTracksByReleaseIdFn: async () => fixtures.trackRows,
  });

  const namingPlan = await service.resolveCanonicalImportNaming({
    candidate: {
      id: 'candidate-1',
      sourceSearchId: 'search-1',
      files: [{
        id: 'file-1',
        extension: 'flac',
        filename: '01 Foil.flac',
        sourceFileIndex: 0,
      }, {
        id: 'file-2',
        extension: 'jpg',
        filename: 'cover?.jpg',
        sourceFileIndex: 1,
      }],
    },
  });

  assert.equal(namingPlan.canApply, true);
  assert.deepEqual(
    Array.from(namingPlan.fileNamesById.entries()),
    [
      ['file-1', '01 - Foil.flac'],
      ['file-2', 'cover.jpg'],
    ],
  );
});

test('createImportCandidateCanonicalNamingService falls back when audio track counts do not match canonical metadata', async () => {
  const fixtures = createMetadataFixtures();
  const service = createImportCandidateCanonicalNamingService({
    findMetadataReleaseIdBySearchId: async () => 'release-1',
    getMetadataArtistByIdFn: async () => fixtures.artist,
    getMetadataReleaseByIdFn: async () => fixtures.release,
    getMetadataReleaseGroupByIdFn: async () => fixtures.releaseGroup,
    listMetadataMediaByReleaseIdFn: async () => fixtures.mediaRows,
    listMetadataTracksByReleaseIdFn: async () => [
      ...fixtures.trackRows,
      {
        id: 'track-2',
        metadata_medium_id: 'medium-1',
        position: 2,
        title: 'Montreal',
      },
    ],
  });

  const namingPlan = await service.resolveCanonicalImportNaming({
    candidate: {
      id: 'candidate-1',
      sourceSearchId: 'search-1',
      files: [{
        id: 'file-1',
        extension: 'flac',
        filename: '01 Foil.flac',
        sourceFileIndex: 0,
      }],
    },
  });

  assert.equal(namingPlan.canApply, false);
  assert.equal(namingPlan.strategy, 'mirror_candidate_path');
  assert.equal(namingPlan.warnings[0].code, 'canonical_naming_track_count_mismatch');
});
