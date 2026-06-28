import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportCandidateSelectionReadiness } from '../../src/server/import-candidates/import-candidate-selection-readiness.js';

test('buildImportCandidateSelectionReadiness returns null without candidates', () => {
  assert.equal(buildImportCandidateSelectionReadiness({ totalCount: 0 }), null);
});

test('buildImportCandidateSelectionReadiness reports high-confidence selectable candidates', () => {
  const readiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: 92,
    scoredCandidateCount: 2,
    secondBestCompositeScore: 80,
    statusCounts: {
      pending: 2,
    },
    totalCount: 2,
  });

  assert.equal(readiness.code, 'auto_selectable');
  assert.equal(readiness.bestCompositeScore, 92);
  assert.equal(readiness.secondBestCompositeScore, 80);
  assert.equal(readiness.scoreGap, 12);
  assert.equal(readiness.thresholds.minCompositeScore, 85);
});

test('buildImportCandidateSelectionReadiness requires review for close candidate scores', () => {
  const readiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: '88.5',
    scoredCandidateCount: 2,
    secondBestCompositeScore: '85.2',
    statusCounts: {
      pending: 2,
    },
    totalCount: 2,
  });

  assert.equal(readiness.code, 'ambiguous');
  assert.equal(readiness.scoreGap, 3.3);
  assert.equal(readiness.tone, 'warning');
});

test('buildImportCandidateSelectionReadiness reports selected handoff state before scoring advice', () => {
  const readiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: 95,
    scoredCandidateCount: 1,
    statusCounts: {
      pending: 1,
      selected: 1,
    },
    totalCount: 2,
  });

  assert.equal(readiness.code, 'selected');
  assert.match(readiness.message, /download worker/i);
});
