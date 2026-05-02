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
      userMusicRoots: [],
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

test('createImportCandidatePreviewService plans per-user library placement when target user context is provided', async () => {
  const service = createImportCandidatePreviewService({
    getAppUserById: async () => ({
      authProvider: 'local',
      id: 'user-1',
      managedLibraryRelativeRoot: 'owned/alice',
    }),
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => ({
      paths: {
        ...createSettings().paths,
        userMusicRoots: [{
          relativeRoot: 'family/alice',
          userId: 'user-1',
        }],
      },
    }),
  });

  const preview = await service.previewImportCandidate({
    importCandidateId: 'candidate-1',
    targetUser: { id: 'user-1' },
  });

  assert.equal(preview.library.rootFolderPolicy, 'per_user_subdirectory');
  assert.deepEqual(preview.library.targetUser, {
    authProvider: 'local',
    configured: true,
    configuredBy: 'app_user',
    id: 'user-1',
    relativeRoot: 'owned/alice',
    userRootPath: '/data/music/users/owned/alice',
  });
  assert.equal(preview.library.userRootPath, '/data/music/users/owned/alice');
  assert.deepEqual(preview.library.configuredUserRootPaths, [
    '/data/music/users/owned/alice',
    '/data/music/users/family/alice',
  ]);
  assert.equal(preview.library.previewFolderPath, '/data/music/users/owned/alice/Autechre/Amber');
  assert.equal(preview.naming.filePreviews[0].libraryPath, '/data/music/users/owned/alice/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.library.reusePolicy.sameVolumeLinkMode, 'prefer_hardlink');
  assert.equal(preview.library.reusePolicy.duplicateLosslessPolicy, 'reuse_existing_lossless_by_default');
});

test('createImportCandidatePreviewService prefers canonical release naming when a shared naming plan is available', async () => {
  const service = createImportCandidatePreviewService({
    canonicalImportNamingService: {
      resolveCanonicalImportNaming: async () => ({
        canApply: true,
        fileNamesById: new Map([
          ['file-1', '01 - Foil.flac'],
        ]),
        relativeFolderPath: 'Autechre/Amber (1994)',
        strategy: 'canonical_release_default_template',
        warnings: [],
      }),
    },
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.library.previewFolderPath, '/data/music/Autechre/Amber (1994)');
  assert.equal(preview.staging.previewFolderPath, '/data/staging/import-candidates/candidate-1/Autechre/Amber (1994)');
  assert.equal(preview.naming.strategy, 'canonical_release_default_template');
  assert.equal(preview.naming.filePreviews[0].filename, '01 - Foil.flac');
  assert.equal(preview.naming.filePreviews[0].rawSourcePath, '/downloads/completed/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.naming.filePreviews[0].sourcePath, '/data/downloads/completed/Autechre/Amber/01 Foil.flac');
  assert.equal(preview.naming.filePreviews[0].libraryPath, '/data/music/Autechre/Amber (1994)/01 - Foil.flac');
  assert.equal(preview.validation.warnings.some((warning) => warning.code === 'naming_preview_mirrors_candidate'), false);
});

test('createImportCandidatePreviewService keeps the mirrored fallback warning when canonical naming cannot be applied', async () => {
  const service = createImportCandidatePreviewService({
    canonicalImportNamingService: {
      resolveCanonicalImportNaming: async () => ({
        canApply: false,
        strategy: 'mirror_candidate_path',
        warnings: [{
          code: 'canonical_naming_track_count_mismatch',
          message: 'Track counts do not line up.',
        }],
      }),
    },
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.naming.strategy, 'mirror_candidate_path');
  assert.equal(preview.validation.warnings.some((warning) => warning.code === 'canonical_naming_track_count_mismatch'), true);
  assert.equal(preview.validation.warnings.some((warning) => warning.code === 'naming_preview_mirrors_candidate'), true);
  assert.equal(preview.naming.filePreviews[0].libraryPath, '/data/music/Autechre/Amber/01 Foil.flac');
});

test('createImportCandidatePreviewService warns when it falls back to the legacy settings-backed user destination mapping', async () => {
  const service = createImportCandidatePreviewService({
    getAppUserById: async () => ({
      authProvider: 'local',
      id: 'user-1',
      managedLibraryRelativeRoot: null,
    }),
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => ({
      paths: {
        ...createSettings().paths,
        userMusicRoots: [{
          relativeRoot: 'family/alice',
          userId: 'user-1',
        }],
      },
    }),
  });

  const preview = await service.previewImportCandidate({
    importCandidateId: 'candidate-1',
    targetUser: { id: 'user-1' },
  });

  assert.equal(preview.library.targetUser.configuredBy, 'settings');
  assert.equal(preview.validation.warnings.some((warning) => warning.code === 'per_user_destination_legacy_settings_fallback'), true);
});

test('createImportCandidatePreviewService warns when the active user has no configured per-user destination', async () => {
  const service = createImportCandidatePreviewService({
    getImportCandidate: async () => createCandidate(),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({
    importCandidateId: 'candidate-1',
    targetUser: { id: 'user-2' },
  });

  assert.equal(preview.library.rootFolderPolicy, 'single_root');
  assert.equal(preview.library.previewFolderPath, '/data/music/Autechre/Amber');
  assert.equal(preview.library.targetUser.configured, false);
  assert.equal(preview.validation.warnings.some((warning) => warning.code === 'per_user_destination_unconfigured'), true);
});

test('createImportCandidatePreviewService blocks archive payload files until guarded extraction is implemented', async () => {
  const service = createImportCandidatePreviewService({
    getImportCandidate: async () => createCandidate({
      files: [{
        extension: '.zip',
        filename: 'archive.zip',
        id: 'file-archive',
      }],
    }),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.validation.canPreview, false);
  assert.equal(preview.validation.blockers.some((blocker) => blocker.code === 'archive_payload_unsupported'), true);
});

test('createImportCandidatePreviewService blocks traversal filenames from provider payloads', async () => {
  const service = createImportCandidatePreviewService({
    getImportCandidate: async () => createCandidate({
      files: [{
        extension: '.flac',
        filename: '../unsafe.flac',
        id: 'file-unsafe',
      }],
    }),
    loadSettingsFn: async () => createSettings(),
  });

  const preview = await service.previewImportCandidate({ importCandidateId: 'candidate-1' });

  assert.equal(preview.validation.canPreview, false);
  assert.equal(preview.validation.blockers.some((blocker) => blocker.code === 'unsafe_source_filename_traversal'), true);
});
