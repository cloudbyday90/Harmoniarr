import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseHintService } from '../../src/server/import-candidates/import-candidate-release-hint-service.js';

test('buildPostApplyReleaseHints maps applied library paths to source search release ids', async (t) => {
  const findMetadataReleaseIdBySearchIdFn = t.mock.fn(async ({ searchId }) => {
    assert.equal(searchId, 'search-1');
    return 'release-1';
  });
  const service = createImportCandidateReleaseHintService({
    findMetadataReleaseIdBySearchIdFn,
  });

  const hints = await service.buildPostApplyReleaseHints({
    applyResult: {
      fileOperations: [{
        libraryPath: 'C:\\Music\\Autechre\\Amber\\01 Foil.flac',
        status: 'applied',
      }, {
        libraryPath: '/music/Autechre/Amber/02 Montreal.flac',
        status: 'applied',
      }, {
        libraryPath: '/music/Autechre/Amber/cover.jpg',
        status: 'skipped',
      }],
    },
    summaryCandidate: {
      id: 'candidate-1',
      sourceSearchId: ' search-1 ',
    },
  });

  assert.deepEqual(hints, [{
    canonicalPath: 'C:/Music/Autechre/Amber/01 Foil.flac',
    importCandidateId: 'candidate-1',
    metadataReleaseId: 'release-1',
    sourceSearchId: 'search-1',
  }, {
    canonicalPath: '/music/Autechre/Amber/02 Montreal.flac',
    importCandidateId: 'candidate-1',
    metadataReleaseId: 'release-1',
    sourceSearchId: 'search-1',
  }]);
  assert.equal(findMetadataReleaseIdBySearchIdFn.mock.callCount(), 1);

  await service.buildPostApplyReleaseHints({
    applyResult: {
      fileOperations: [{
        libraryPath: '/music/Autechre/Amber/03 Teartear.flac',
        status: 'applied',
      }],
    },
    summaryCandidate: {
      id: 'candidate-2',
      sourceSearchId: 'search-1',
    },
  });

  assert.equal(findMetadataReleaseIdBySearchIdFn.mock.callCount(), 1);
});

test('buildPostApplyReleaseHints returns no hints without release lookup or applied files', async () => {
  const service = createImportCandidateReleaseHintService({
    findMetadataReleaseIdBySearchIdFn: async () => null,
  });

  assert.deepEqual(await service.buildPostApplyReleaseHints({
    applyResult: {
      fileOperations: [{
        libraryPath: '/music/Autechre/Amber/01 Foil.flac',
        status: 'applied',
      }],
    },
    summaryCandidate: {
      sourceSearchId: 'search-1',
    },
  }), []);
});
