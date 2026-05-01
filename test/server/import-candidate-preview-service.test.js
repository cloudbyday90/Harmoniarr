import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidatePreviewService } from '../../src/server/import-candidates/import-candidate-preview-service.js';

function createCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    status: 'selected',
    fileCount: 1,
    files: [{
      id: 'file-1',
      filename: '01 Foil.flac',
      folderPath: 'Autechre\\Amber',
    }],
    ...overrides,
  };
}

function createSettings() {
  return {
    paths: {
      downloadMappings: [{
        slskdPrefix: '/downloads/completed',
        harmoniarrPrefix: '/data/downloads/completed',
      }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
    },
  };
}

test('createImportCandidatePreviewService builds read-only path and naming preview from explicit mapping settings', async () => {
  const service = createImportCandidatePreviewService({
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.source.resolutionStrategy, 'mapping_relative_candidate');
  assert.equal(preview.source.sourceFolderPath, '/downloads/completed/Autechre/Amber');
  assert.equal(preview.source.resolvedFolderPath, '/data/downloads/completed/Autechre/Amber');
  assert.equal(preview.staging.previewFolderPath, '/data/staging/import-candidates/candidate-1/Autechre/Amber');
  assert.equal(preview.library.previewFolderPath, '/data/music/Autechre/Amber');
  assert.equal(preview.naming.filePreviews[0].rawSourcePath, '/downloads/completed/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.naming.filePreviews[0].sourcePath, '/data/downloads/completed/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.naming.filePreviews[0].libraryPath, '/data/music/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.validation.canPreview, true);
  assert.equal(preview.validation.warnings[0].code, 'naming_preview_mirrors_candidate');
});

test('createImportCandidatePreviewService blocks ambiguous relative candidates when multiple mappings exist', async () => {
  const service = createImportCandidatePreviewService({
    getImportCandidate: async () => createCandidate({
      folderPath: 'Autechre\\Amber',
    }),
    loadSettingsFn: async () => ({
      paths: {
        downloadMappings: [{
          slskdPrefix: '/downloads/completed',
          harmoniarrPrefix: '/data/downloads/completed',
        }, {
          slskdPrefix: '/downloads/alt-completed',
          harmoniarrPrefix: '/data/downloads/alt-completed',
        }],
        downloads: '/data/downloads',
        music: '/data/music',
        staging: '/data/staging',
      },
    }),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.validation.canPreview, false);
  assert.equal(preview.validation.blockers[0].code, 'ambiguous_relative_candidate_path');
  assert.equal(preview.naming.filePreviews[0].sourcePath, null);
});