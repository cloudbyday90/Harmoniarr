import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AUTO_SELECTION_REASON,
  buildImportCandidateAutoSelectionEvaluation,
  createImportCandidateAutoSelectionService,
} from '../../src/server/import-candidates/import-candidate-auto-selection-service.js';

function buildCandidate({
  compositeScore,
  extensions = ['flac'],
  id,
  bitrateKbps = null,
  status = 'pending',
}) {
  return {
    id,
    normalizedPayload: {
      bitrateKbps,
      compositeScore,
      extensions,
    },
    status,
  };
}

test('buildImportCandidateAutoSelectionEvaluation identifies a high-confidence best candidate', () => {
  const evaluation = buildImportCandidateAutoSelectionEvaluation({
    candidates: [
      buildCandidate({ compositeScore: 81, id: 'candidate-2' }),
      buildCandidate({ compositeScore: 94, id: 'candidate-1' }),
    ],
  });

  assert.equal(evaluation.bestCandidate.id, 'candidate-1');
  assert.equal(evaluation.readiness.code, 'auto_selectable');
  assert.equal(evaluation.readiness.scoreGap, 13);
});

test('selectHighConfidenceCandidate selects only the best auto-selectable candidate', async (t) => {
  const listImportCandidates = t.mock.fn(async () => ({
    candidates: [
      buildCandidate({ compositeScore: 89, id: 'candidate-lower' }),
      buildCandidate({ compositeScore: 97, id: 'candidate-best' }),
    ],
  }));
  const selectImportCandidate = t.mock.fn(async () => ({
    candidate: { id: 'candidate-best', status: 'selected' },
  }));
  const service = createImportCandidateAutoSelectionService({
    listImportCandidates,
    selectImportCandidate,
  });

  const result = await service.selectHighConfidenceCandidate({
    actorUserId: 'operator-1',
    requestMetadata: {
      ipAddress: '198.51.100.24',
      userAgent: 'AutoSelectionTest/1.0',
    },
    sourceSearchId: ' search-1 ',
  });

  assert.deepEqual(listImportCandidates.mock.calls[0].arguments[0], {
    limit: 100,
    offset: 0,
    sourceSearchId: 'search-1',
  });
  assert.deepEqual(selectImportCandidate.mock.calls[0].arguments[0], {
    actorUserId: 'operator-1',
    importCandidateId: 'candidate-best',
    reason: DEFAULT_AUTO_SELECTION_REASON,
    requestMetadata: {
      ipAddress: '198.51.100.24',
      userAgent: 'AutoSelectionTest/1.0',
    },
  });
  assert.equal(result.selected, true);
  assert.equal(result.selectedCandidateId, 'candidate-best');
  assert.equal(result.readiness.code, 'auto_selectable');
});

test('selectHighConfidenceCandidate skips ambiguous close-scoring candidates', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => {
    throw new Error('should not select ambiguous candidates');
  });
  const service = createImportCandidateAutoSelectionService({
    listImportCandidates: t.mock.fn(async () => ({
      candidates: [
        buildCandidate({ compositeScore: 91, id: 'candidate-1' }),
        buildCandidate({ compositeScore: 88, id: 'candidate-2' }),
      ],
    })),
    selectImportCandidate,
  });

  const result = await service.selectHighConfidenceCandidate({ sourceSearchId: 'search-1' });

  assert.equal(selectImportCandidate.mock.callCount(), 0);
  assert.equal(result.selected, false);
  assert.equal(result.skippedReason, 'ambiguous');
  assert.equal(result.readiness.code, 'ambiguous');
});

test('selectHighConfidenceCandidate skips low-confidence or already-selected results', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => {});
  const lowConfidenceService = createImportCandidateAutoSelectionService({
    listImportCandidates: t.mock.fn(async () => ({
      candidates: [
        buildCandidate({ compositeScore: 79, id: 'candidate-low' }),
      ],
    })),
    selectImportCandidate,
  });
  const selectedService = createImportCandidateAutoSelectionService({
    listImportCandidates: t.mock.fn(async () => ({
      candidates: [
        buildCandidate({ compositeScore: 96, id: 'candidate-selected', status: 'selected' }),
      ],
    })),
    selectImportCandidate,
  });

  const lowConfidence = await lowConfidenceService.selectHighConfidenceCandidate({ sourceSearchId: 'search-low' });
  const alreadySelected = await selectedService.selectHighConfidenceCandidate({ sourceSearchId: 'search-selected' });

  assert.equal(selectImportCandidate.mock.callCount(), 0);
  assert.equal(lowConfidence.skippedReason, 'low_confidence');
  assert.equal(alreadySelected.skippedReason, 'selected');
});

test('selectHighConfidenceCandidate skips strict lossless when only lossy matches are available', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => {
    throw new Error('should not select below-profile candidates');
  });
  const service = createImportCandidateAutoSelectionService({
    listImportCandidates: t.mock.fn(async () => ({
      candidates: [
        buildCandidate({
          bitrateKbps: 320,
          compositeScore: 97,
          extensions: ['mp3'],
          id: 'candidate-mp3',
        }),
      ],
    })),
    qualityPolicyService: {
      evaluateQualityEvidence: ({ candidate, profileCode }) => ({
        autoDownloadEligible: false,
        code: profileCode === 'lossless_archive' && candidate.normalizedPayload.extensions.includes('mp3')
          ? 'below_minimum'
          : 'accepted',
      }),
    },
    selectImportCandidate,
  });

  const result = await service.selectHighConfidenceCandidate({
    profileCode: 'lossless_archive',
    sourceSearchId: 'search-lossless',
  });

  assert.equal(selectImportCandidate.mock.callCount(), 0);
  assert.equal(result.selected, false);
  assert.equal(result.skippedReason, 'quality_below_minimum');
  assert.equal(result.quality.code, 'below_minimum');
});

test('selectHighConfidenceCandidate selects the highest-scoring quality-eligible match', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => ({
    candidate: { id: 'candidate-flac', status: 'selected' },
  }));
  const service = createImportCandidateAutoSelectionService({
    listImportCandidates: t.mock.fn(async () => ({
      candidates: [
        buildCandidate({
          bitrateKbps: 320,
          compositeScore: 99,
          extensions: ['mp3'],
          id: 'candidate-mp3',
        }),
        buildCandidate({
          compositeScore: 94,
          extensions: ['flac'],
          id: 'candidate-flac',
        }),
      ],
    })),
    qualityPolicyService: {
      evaluateQualityEvidence: ({ candidate }) => {
        if (candidate.normalizedPayload.extensions.includes('mp3')) {
          return { autoDownloadEligible: false, code: 'below_minimum' };
        }
        return { autoDownloadEligible: true, code: 'accepted' };
      },
    },
    selectImportCandidate,
  });

  const result = await service.selectHighConfidenceCandidate({
    profileCode: 'lossless_archive',
    sourceSearchId: 'search-flac',
  });

  assert.equal(result.selected, true);
  assert.equal(result.selectedCandidateId, 'candidate-flac');
  assert.equal(result.scoredCandidateCount, 1);
  assert.deepEqual(selectImportCandidate.mock.calls[0].arguments[0], {
    actorUserId: null,
    importCandidateId: 'candidate-flac',
    reason: DEFAULT_AUTO_SELECTION_REASON,
    requestMetadata: null,
  });
});
