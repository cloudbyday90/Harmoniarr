import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDownloaderImportCandidateLocation } from '../../src/client/lib/downloader-import-review-link.js';

test('buildDownloaderImportCandidateLocation links downloader rows to advanced match diagnostics', () => {
  assert.deepEqual(buildDownloaderImportCandidateLocation({
    diagnostics: {
      importLinkage: {
        candidateId: 'candidate-1',
      },
    },
  }), {
    name: 'activity-diagnostics-matches',
    query: {
      candidate: 'candidate-1',
      status: 'all',
    },
  });
});

test('buildDownloaderImportCandidateLocation returns null without candidate linkage', () => {
  assert.equal(buildDownloaderImportCandidateLocation({
    diagnostics: {
      importLinkage: {
        status: 'not_linked',
      },
    },
  }), null);
});
