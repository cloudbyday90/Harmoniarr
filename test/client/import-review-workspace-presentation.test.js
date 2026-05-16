import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImportReviewOverviewCards,
  buildImportReviewWorkflowStages,
} from '../../src/client/lib/import-review-workspace-presentation.js';

test('buildImportReviewOverviewCards builds admin cards with queue, selected, and import-pending state', () => {
  const cards = buildImportReviewOverviewCards({
    activeFilterCount: 2,
    importPendingCounts: {
      blocked: 0,
      ready: 1,
      readyWithWarnings: 0,
      totalImportPending: 1,
    },
    isAdmin: true,
    pagination: { total: 12 },
    selectedCounts: {
      blocked: 1,
      ready: 3,
      readyWithWarnings: 1,
      totalSelected: 5,
    },
    statusFilter: 'pending',
  });

  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((card) => card.id), ['visible', 'selected', 'import-pending']);
  assert.equal(cards[0].value, '12');
  assert.equal(cards[1].tone, 'danger');
  assert.equal(cards[2].tone, 'success');
});

test('buildImportReviewOverviewCards omits import-pending card for non-admin users', () => {
  const cards = buildImportReviewOverviewCards({
    isAdmin: false,
    pagination: { total: 4 },
    selectedCounts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalSelected: 0,
    },
    statusFilter: '',
  });

  assert.deepEqual(cards.map((card) => card.id), ['visible', 'selected']);
});

test('buildImportReviewWorkflowStages describes staged workflow state from counts and summaries', () => {
  const stages = buildImportReviewWorkflowStages({
    applyCurrentRun: {
      appliedCount: 2,
      status: 'completed',
    },
    applySummary: {
      message: '2 candidates were applied.',
      status: 'completed',
    },
    importPendingCounts: {
      totalImportPending: 2,
    },
    selectedCounts: {
      blocked: 0,
      ready: 3,
      readyWithWarnings: 1,
      totalSelected: 4,
    },
    executionCurrentRun: {
      queuedCount: 3,
      status: 'running',
    },
    executionSummary: {
      message: '3 candidates are queued for download.',
      status: 'running',
    },
    mediaInspectionCurrentRun: {
      status: 'failed',
      warningCount: 5,
    },
    mediaInspectionSummary: {
      message: '5 warnings need review.',
      status: 'failed',
    },
  });

  assert.equal(stages.length, 4);
  assert.equal(stages[0].metric.value, '4');
  assert.equal(stages[1].tone, 'danger');
  assert.equal(stages[2].metric.label, 'Queued');
  assert.equal(stages[3].body, '2 candidates were applied.');
  assert.equal(stages[3].tone, 'success');
});

