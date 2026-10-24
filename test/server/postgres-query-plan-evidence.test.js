/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizePostgresQueryPlan, explainPreparedPage } from '../../testing/server/postgres-query-plan-evidence.js';

test('plan evidence uses root buffer counters and counts heap rejections without duplicating bitmap index tuples', () => {
  const summary = summarizePostgresQueryPlan({ 'Execution Time': 1, Plan: { 'Node Type': 'Limit', 'Shared Hit Blocks': 5, 'Shared Read Blocks': 7,
    Plans: [{ 'Node Type': 'Sort', Plans: [{ 'Node Type': 'Bitmap Heap Scan', 'Actual Rows': 10, 'Actual Loops': 2,
      'Rows Removed by Filter': 7, 'Rows Removed by Index Recheck': 3, 'Shared Hit Blocks': 5, 'Shared Read Blocks': 7,
      Plans: [{ 'Node Type': 'Bitmap Index Scan', 'Actual Rows': 100, 'Actual Loops': 2, 'Index Name': 'scoped_idx', 'Index Cond': 'source = $1' }] }] }] } });
  assert.equal(summary.bufferAccesses, 12); assert.equal(summary.examinedRows, 40); assert.equal(summary.rejectedRows, 20);
  assert.equal(summary.hasSort, true); assert.deepEqual(summary.indexes, [{ name: 'scoped_idx', condition: 'source = $1' }]);
});

test('failed plan execution retires the transaction and statement while preserving an original null failure', async () => {
  const calls = []; let caught = false;
  const client = { query: async text => {
    calls.push(text);
    if (text.startsWith('EXPLAIN')) throw null;
    if (text === 'ROLLBACK') throw new Error('later rollback failure');
    return { rows: [] };
  } };
  try { await explainPreparedPage(client, { text: 'SELECT $1::text LIMIT $2', values: ['fixture', 50] }, 'force_generic_plan'); }
  catch (error) { caught = true; assert.equal(error, null); }
  assert.equal(caught, true); assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'DEALLOCATE candidate_page_profile']);
  assert.ok(calls.includes('SET LOCAL plan_cache_mode=force_generic_plan'));
});

test('a null cleanup failure after successful execution is reported and later cleanup is still attempted', async () => {
  const calls = []; let caught = false;
  const client = { query: async text => {
    calls.push(text);
    if (text.startsWith('EXPLAIN')) return { rows: [{ 'QUERY PLAN': [{ Plan: { 'Node Type': 'Result' } }] }] };
    if (text === 'ROLLBACK') throw null;
    return { rows: [] };
  } };
  try { await explainPreparedPage(client, { text: 'SELECT $1::text LIMIT $2', values: ['fixture', 50] }, 'force_custom_plan'); }
  catch (error) { caught = true; assert.equal(error, null); }
  assert.equal(caught, true); assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'DEALLOCATE candidate_page_profile']);
});
