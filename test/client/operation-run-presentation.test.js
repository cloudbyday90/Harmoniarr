import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOperationRunAttentionLabel,
  getOperationRunDuration,
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

// ---------------------------------------------------------------------------
// getOperationRunDuration
// ---------------------------------------------------------------------------

test('getOperationRunDuration returns null when startedAt is absent', () => {
  assert.equal(getOperationRunDuration({ status: 'completed', finishedAt: '2026-05-04T12:01:00.000Z' }), null);
});

test('getOperationRunDuration returns null when startedAt is not a valid date', () => {
  assert.equal(getOperationRunDuration({ startedAt: 'not-a-date', status: 'completed' }), null);
});

test('getOperationRunDuration formats sub-minute completed runs as seconds', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T12:00:45.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '45s');
});

test('getOperationRunDuration formats exactly 60 seconds as 1m', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T12:01:00.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '1m');
});

test('getOperationRunDuration formats minutes-and-seconds completed runs', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T12:03:25.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '3m 25s');
});

test('getOperationRunDuration formats exactly-whole-minute completed runs without seconds part', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T12:05:00.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '5m');
});

test('getOperationRunDuration formats hour-long runs with remaining minutes', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T13:15:00.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '1h 15m');
});

test('getOperationRunDuration formats exactly whole-hour runs without minutes part', () => {
  const run = {
    startedAt: '2026-05-04T12:00:00.000Z',
    finishedAt: '2026-05-04T14:00:00.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), '2h');
});

test('getOperationRunDuration uses nowFn for running runs', () => {
  const startedAt = '2026-05-04T12:00:00.000Z';
  const nowMs = new Date('2026-05-04T12:02:30.000Z').getTime();
  const run = { startedAt, status: 'running' };
  assert.equal(getOperationRunDuration(run, { nowFn: () => nowMs }), '2m 30s');
});

test('getOperationRunDuration uses nowFn for pending runs', () => {
  const startedAt = '2026-05-04T12:00:00.000Z';
  const nowMs = new Date('2026-05-04T12:00:10.000Z').getTime();
  const run = { startedAt, status: 'pending' };
  assert.equal(getOperationRunDuration(run, { nowFn: () => nowMs }), '10s');
});

test('getOperationRunDuration returns null for completed runs without finishedAt', () => {
  const run = { startedAt: '2026-05-04T12:00:00.000Z', status: 'completed' };
  assert.equal(getOperationRunDuration(run), null);
});

test('getOperationRunDuration returns null when duration is negative', () => {
  const run = {
    startedAt: '2026-05-04T12:01:00.000Z',
    finishedAt: '2026-05-04T12:00:00.000Z',
    status: 'completed',
  };
  assert.equal(getOperationRunDuration(run), null);
});