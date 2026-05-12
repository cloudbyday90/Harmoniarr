import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationSummaryEntries,
  formatLeaseStateLabel,
  formatLeaseStateTone,
  formatOperationEventTypeLabel,
  formatOperationGroupTone,
  formatOperationRunStatusTone,
  formatOperationSummaryLabel,
  formatOperationSummaryValue,
  formatOperationTimestamp,
  formatOperationTimestampShort,
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

// ---------------------------------------------------------------------------
// formatOperationTimestamp
// ---------------------------------------------------------------------------

test('formatOperationTimestamp returns Not yet recorded for null', () => {
  assert.equal(formatOperationTimestamp(null), 'Not yet recorded');
});

test('formatOperationTimestamp returns Not yet recorded for undefined', () => {
  assert.equal(formatOperationTimestamp(undefined), 'Not yet recorded');
});

test('formatOperationTimestamp returns Not yet recorded for empty string', () => {
  assert.equal(formatOperationTimestamp(''), 'Not yet recorded');
});

test('formatOperationTimestamp formats a valid ISO 8601 string as a locale string', () => {
  const result = formatOperationTimestamp('2026-05-04T12:00:00.000Z');
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
  assert.notEqual(result, '2026-05-04T12:00:00.000Z');
  assert.notEqual(result, 'Not yet recorded');
});

test('formatOperationTimestamp passes through an unparseable value as-is', () => {
  assert.equal(formatOperationTimestamp('not-a-date'), 'not-a-date');
});

// ---------------------------------------------------------------------------
// formatOperationTimestampShort
// ---------------------------------------------------------------------------

test('formatOperationTimestampShort returns em dash for null', () => {
  assert.equal(formatOperationTimestampShort(null), '—');
});

test('formatOperationTimestampShort returns em dash for undefined', () => {
  assert.equal(formatOperationTimestampShort(undefined), '—');
});

test('formatOperationTimestampShort returns Just now for timestamps under 60 seconds ago', () => {
  const ts = new Date('2026-05-04T12:00:00.000Z').toISOString();
  const nowMs = new Date('2026-05-04T12:00:30.000Z').getTime();
  assert.equal(formatOperationTimestampShort(ts, { nowFn: () => nowMs }), 'Just now');
});

test('formatOperationTimestampShort returns Xm ago for timestamps 1-59 minutes ago', () => {
  const ts = new Date('2026-05-04T12:00:00.000Z').toISOString();
  const nowMs = new Date('2026-05-04T12:15:00.000Z').getTime();
  assert.equal(formatOperationTimestampShort(ts, { nowFn: () => nowMs }), '15m ago');
});

test('formatOperationTimestampShort does not return Just now for exactly 60 seconds ago', () => {
  const ts = new Date('2026-05-04T12:00:00.000Z').toISOString();
  const nowMs = new Date('2026-05-04T12:01:00.000Z').getTime();
  assert.notEqual(formatOperationTimestampShort(ts, { nowFn: () => nowMs }), 'Just now');
});

test('formatOperationTimestampShort returns locale date for timestamps over 24 hours ago', () => {
  const ts = new Date('2026-05-03T10:00:00.000Z').toISOString();
  const nowMs = new Date('2026-05-04T11:00:00.000Z').getTime();
  const result = formatOperationTimestampShort(ts, { nowFn: () => nowMs });
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.doesNotMatch(result, /ago/);
  assert.doesNotMatch(result, /Just now/);
});

test('formatOperationTimestampShort passes through unparseable values as-is', () => {
  const nowMs = Date.now();
  assert.equal(formatOperationTimestampShort('bad', { nowFn: () => nowMs }), 'bad');
});

// ---------------------------------------------------------------------------
// formatOperationRunStatusTone
// ---------------------------------------------------------------------------

test('formatOperationRunStatusTone returns danger for failed', () => {
  assert.equal(formatOperationRunStatusTone('failed'), 'danger');
});

test('formatOperationRunStatusTone returns warning for cancelled', () => {
  assert.equal(formatOperationRunStatusTone('cancelled'), 'warning');
});

test('formatOperationRunStatusTone returns success for running', () => {
  assert.equal(formatOperationRunStatusTone('running'), 'success');
});

test('formatOperationRunStatusTone returns null for completed', () => {
  assert.equal(formatOperationRunStatusTone('completed'), null);
});

test('formatOperationRunStatusTone returns null for unknown status', () => {
  assert.equal(formatOperationRunStatusTone('pending'), null);
});

test('formatOperationRunStatusTone returns null for null', () => {
  assert.equal(formatOperationRunStatusTone(null), null);
});

// ---------------------------------------------------------------------------
// formatOperationGroupTone
// ---------------------------------------------------------------------------

test('formatOperationGroupTone returns danger for needs-attention', () => {
  assert.equal(formatOperationGroupTone('needs-attention'), 'danger');
});

test('formatOperationGroupTone returns success for in-progress', () => {
  assert.equal(formatOperationGroupTone('in-progress'), 'success');
});

test('formatOperationGroupTone returns null for completed', () => {
  assert.equal(formatOperationGroupTone('completed'), null);
});

test('formatOperationGroupTone returns null for unknown groupId', () => {
  assert.equal(formatOperationGroupTone('unknown-group'), null);
});

test('formatOperationGroupTone returns null for null', () => {
  assert.equal(formatOperationGroupTone(null), null);
});

// ---------------------------------------------------------------------------
// formatLeaseStateLabel
// ---------------------------------------------------------------------------

test('formatLeaseStateLabel returns Active for active', () => {
  assert.equal(formatLeaseStateLabel('active'), 'Active');
});

test('formatLeaseStateLabel returns Expired for expired', () => {
  assert.equal(formatLeaseStateLabel('expired'), 'Expired');
});

test('formatLeaseStateLabel returns Released for released', () => {
  assert.equal(formatLeaseStateLabel('released'), 'Released');
});

test('formatLeaseStateLabel returns Unknown for null', () => {
  assert.equal(formatLeaseStateLabel(null), 'Unknown');
});

test('formatLeaseStateLabel returns Unknown for unrecognised state', () => {
  assert.equal(formatLeaseStateLabel('pending'), 'Unknown');
});

// ---------------------------------------------------------------------------
// formatLeaseStateTone
// ---------------------------------------------------------------------------

test('formatLeaseStateTone returns success for active', () => {
  assert.equal(formatLeaseStateTone('active'), 'success');
});

test('formatLeaseStateTone returns danger for expired', () => {
  assert.equal(formatLeaseStateTone('expired'), 'danger');
});

test('formatLeaseStateTone returns null for released', () => {
  assert.equal(formatLeaseStateTone('released'), null);
});

test('formatLeaseStateTone returns null for null', () => {
  assert.equal(formatLeaseStateTone(null), null);
});

// ---------------------------------------------------------------------------
// buildOperationSummaryEntries
// ---------------------------------------------------------------------------

test('buildOperationSummaryEntries returns empty array for null', () => {
  assert.deepEqual(buildOperationSummaryEntries(null), []);
});

test('buildOperationSummaryEntries filters out null and undefined values', () => {
  const result = buildOperationSummaryEntries({ a: null, b: undefined, c: 'value' });
  assert.equal(result.length, 1);
  assert.equal(result[0].key, 'c');
});

test('buildOperationSummaryEntries returns key/value pairs', () => {
  const result = buildOperationSummaryEntries({ count: 5 });
  assert.deepEqual(result, [{ key: 'count', value: 5 }]);
});

test('buildOperationSummaryEntries caps output at 12 entries', () => {
  const big = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`key${i}`, i]));
  assert.equal(buildOperationSummaryEntries(big).length, 12);
});

test('buildOperationSummaryEntries returns empty array for empty object', () => {
  assert.deepEqual(buildOperationSummaryEntries({}), []);
});

// ---------------------------------------------------------------------------
// formatOperationSummaryLabel
// ---------------------------------------------------------------------------

test('formatOperationSummaryLabel converts camelCase to Title Case', () => {
  assert.equal(formatOperationSummaryLabel('importedCount'), 'Imported Count');
});

test('formatOperationSummaryLabel converts snake_case to Title Case', () => {
  assert.equal(formatOperationSummaryLabel('total_records'), 'Total Records');
});

test('formatOperationSummaryLabel handles a single word', () => {
  assert.equal(formatOperationSummaryLabel('status'), 'Status');
});

test('formatOperationSummaryLabel handles mixed camel and pascal', () => {
  assert.equal(formatOperationSummaryLabel('ErrorMessage'), 'Error Message');
});

// ---------------------------------------------------------------------------
// formatOperationSummaryValue
// ---------------------------------------------------------------------------

test('formatOperationSummaryValue formats arrays as record count', () => {
  assert.equal(formatOperationSummaryValue([1, 2, 3]), '3 records');
});

test('formatOperationSummaryValue uses singular record for single-element arrays', () => {
  assert.equal(formatOperationSummaryValue([42]), '1 record');
});

test('formatOperationSummaryValue returns Yes for true', () => {
  assert.equal(formatOperationSummaryValue(true), 'Yes');
});

test('formatOperationSummaryValue returns No for false', () => {
  assert.equal(formatOperationSummaryValue(false), 'No');
});

test('formatOperationSummaryValue returns Structured data recorded for plain objects', () => {
  assert.equal(formatOperationSummaryValue({ nested: 1 }), 'Structured data recorded');
});

test('formatOperationSummaryValue returns string representation for numbers', () => {
  assert.equal(formatOperationSummaryValue(42), '42');
});

test('formatOperationSummaryValue returns string representation for strings', () => {
  assert.equal(formatOperationSummaryValue('hello'), 'hello');
});

// ---------------------------------------------------------------------------
// formatOperationEventTypeLabel
// ---------------------------------------------------------------------------

test('formatOperationEventTypeLabel returns empty string for null', () => {
  assert.equal(formatOperationEventTypeLabel(null), '');
});

test('formatOperationEventTypeLabel returns empty string for undefined', () => {
  assert.equal(formatOperationEventTypeLabel(undefined), '');
});

test('formatOperationEventTypeLabel translates known run_started', () => {
  assert.equal(formatOperationEventTypeLabel('run_started'), 'Run started');
});

test('formatOperationEventTypeLabel translates known run_failed', () => {
  assert.equal(formatOperationEventTypeLabel('run_failed'), 'Run failed');
});

test('formatOperationEventTypeLabel translates known step_completed', () => {
  assert.equal(formatOperationEventTypeLabel('step_completed'), 'Step completed');
});

test('formatOperationEventTypeLabel translates run_claimed to Processing started', () => {
  assert.equal(formatOperationEventTypeLabel('run_claimed'), 'Processing started');
});

test('formatOperationEventTypeLabel translates run_heartbeat to Progress check-in', () => {
  assert.equal(formatOperationEventTypeLabel('run_heartbeat'), 'Progress check-in');
});

test('formatOperationEventTypeLabel does not return a raw underscore string for known types', () => {
  const known = ['run_started', 'run_completed', 'run_failed', 'run_cancelled', 'step_completed'];
  for (const type of known) {
    assert.doesNotMatch(formatOperationEventTypeLabel(type), /_/);
  }
});

test('formatOperationEventTypeLabel title-cases unknown event types as a fallback', () => {
  const result = formatOperationEventTypeLabel('custom_event_type');
  assert.doesNotMatch(result, /_/);
  assert.match(result, /^[A-Z]/);
});