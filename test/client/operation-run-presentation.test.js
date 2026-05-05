import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOperationRunAttentionLabel,
  getOperationRunNextStep,
  getOperationRunOperatorSummary,
  groupOperationRunsForDisplay,
} from '../../src/client/lib/operation-run-presentation.js';

test('operation run presentation summarizes high-attention failures in operator language', () => {
  const run = {
    operationType: 'library_scan',
    status: 'failed',
  };

  assert.equal(getOperationRunAttentionLabel(run), 'Needs attention');
  assert.equal(
    getOperationRunOperatorSummary(run),
    'Library scan stopped before completion and should be reviewed before it is retried.',
  );
  assert.equal(
    getOperationRunNextStep(run),
    'Review the failure details, fix the underlying problem, then retry the run when you are ready.',
  );
});

test('operation run presentation explains queued work without surfacing worker jargon', () => {
  const run = {
    nextAttemptAt: '2026-05-04T18:30:00.000Z',
    operationType: 'import_candidate_execution_planning',
    status: 'pending',
  };

  assert.equal(
    getOperationRunOperatorSummary(run),
    'Import execution is queued to try again after the current delay window.',
  );
  assert.equal(
    getOperationRunNextStep(run),
    'No immediate action is required unless the queue appears stuck or you need to cancel the pending work.',
  );
});

test('groupOperationRunsForDisplay prioritizes failed work ahead of active and completed runs', () => {
  const groupedRuns = groupOperationRunsForDisplay([
    { id: 'run-1', operationType: 'library_scan', status: 'completed' },
    { id: 'run-2', operationType: 'library_discovery_dispatch', status: 'running' },
    { id: 'run-3', operationType: 'artwork_cleanup', status: 'failed' },
  ]);

  assert.deepEqual(groupedRuns.map((group) => ({
    id: group.id,
    runIds: group.runs.map((run) => run.id),
  })), [
    { id: 'needs-attention', runIds: ['run-3'] },
    { id: 'in-progress', runIds: ['run-2'] },
    { id: 'completed', runIds: ['run-1'] },
  ]);
});