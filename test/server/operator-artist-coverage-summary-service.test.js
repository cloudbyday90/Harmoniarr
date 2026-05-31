import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listDesiredReleaseIds,
  summarizeOperatorArtistCoverage,
} from '../../src/server/metadata/operator-artist-coverage-summary-service.js';

test('listDesiredReleaseIds returns unique resolved selected and partial release ids', () => {
  assert.deepEqual(listDesiredReleaseIds([
    {
      operatorState: {
        resolvedMetadataReleaseId: 'release-1',
        selectionState: 'selected',
      },
    },
    {
      operatorState: {
        resolvedMetadataReleaseId: 'release-1',
        selectionState: 'partial',
      },
    },
    {
      operatorState: {
        resolvedMetadataReleaseId: 'release-2',
        selectionState: 'unselected',
      },
    },
    {
      operatorState: {
        resolvedMetadataReleaseId: 'release-3',
        selectionState: 'partial',
      },
    },
  ]), ['release-1', 'release-3']);
});

test('summarizeOperatorArtistCoverage counts acquired partial missing duplicate and unresolved releases', () => {
  const summary = summarizeOperatorArtistCoverage({
    effectiveReleaseGroups: [
      {
        operatorState: {
          resolvedMetadataReleaseId: 'release-complete',
          selectionState: 'selected',
        },
      },
      {
        operatorState: {
          resolvedMetadataReleaseId: 'release-duplicate',
          selectionState: 'selected',
        },
      },
      {
        operatorState: {
          resolvedMetadataReleaseId: 'release-partial',
          selectionState: 'partial',
        },
      },
      {
        operatorState: {
          resolvedMetadataReleaseId: 'release-missing',
          selectionState: 'selected',
        },
      },
      {
        operatorState: {
          resolvedMetadataReleaseId: null,
          selectionState: 'selected',
        },
      },
      {
        operatorState: {
          resolvedMetadataReleaseId: 'release-ignored',
          selectionState: 'unselected',
        },
      },
    ],
    libraryReleaseReconciliations: [
      {
        lastReconciledAt: '2026-05-25T10:00:00.000Z',
        metadataReleaseId: 'release-complete',
        reconciliationStatus: 'complete',
      },
      {
        lastReconciledAt: '2026-05-26T10:00:00.000Z',
        metadataReleaseId: 'release-duplicate',
        reconciliationStatus: 'duplicate',
      },
      {
        lastReconciledAt: '2026-05-24T10:00:00.000Z',
        metadataReleaseId: 'release-partial',
        reconciliationStatus: 'partial',
      },
    ],
  });

  assert.deepEqual(summary, {
    acquiredReleaseCount: 2,
    coverageRatio: 0.5,
    desiredReleaseCount: 4,
    duplicateReleaseCount: 1,
    lastReconciledAt: '2026-05-26T10:00:00.000Z',
    missingReleaseCount: 1,
    partialReleaseCount: 1,
    unresolvedReleaseCount: 1,
  });
});

test('summarizeOperatorArtistCoverage returns zero coverage for no desired releases', () => {
  assert.deepEqual(summarizeOperatorArtistCoverage(), {
    acquiredReleaseCount: 0,
    coverageRatio: 0,
    desiredReleaseCount: 0,
    duplicateReleaseCount: 0,
    lastReconciledAt: null,
    missingReleaseCount: 0,
    partialReleaseCount: 0,
    unresolvedReleaseCount: 0,
  });
});
