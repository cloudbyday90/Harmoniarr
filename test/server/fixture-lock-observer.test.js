/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { createFixtureLockObserver, waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';

test('borrowed observation drains its active read and refuses new admission after cancellation or close', async () => {
  for (const reason of [new Error('Controlled observer cancellation'), null]) {
    const controller = new AbortController(); const read = createFixtureGate(); let reads = 0; let drained = false;
    const observer = createFixtureLockObserver({ signal: controller.signal, queryable: { query: () => { reads += 1; return read.promise; } } });
    const current = observer.query('owned idle read');
    assert.throws(() => observer.query('overlapping read'), { code: 'fixture_observer_busy' });
    controller.abort(reason);
    try { observer.query('late read'); assert.fail('Cancelled observation admitted work'); } catch (error) { assert.equal(error, reason); }
    const closing = observer.drain().then(() => { drained = true; });
    await setImmediate(); assert.equal(drained, false); assert.equal(reads, 1);
    read.release({ rowCount: 0 }); await current; await closing; assert.equal(drained, true);
  }
  const observer = createFixtureLockObserver({ queryable: { query: async () => ({ rowCount: 0 }) } });
  await observer.drain(); assert.throws(() => observer.query('read after normal resume'), { code: 'fixture_observer_closed' });
});

test('a failed borrowed query retains its original error while draining permits owner cleanup', async () => {
  const failure = new Error('Controlled statistics read failure'); const read = createFixtureGate();
  const observer = createFixtureLockObserver({ queryable: { query: () => read.promise } });
  const current = observer.query('owned read'); const closing = observer.drain(); read.abort(failure);
  await assert.rejects(current, (error) => error === failure); await closing;
});

test('each PostgreSQL activity poll first clears its transaction statistics snapshot', async () => {
  const operation = createFixtureGate(); const calls = []; let cleared = false; let polls = 0;
  await waitForFixturePostgresBlock({ holderPid: 42, operation: operation.promise, queryable: { query: async (sql, values) => {
    if (sql === 'SELECT pg_stat_clear_snapshot()') { cleared = true; calls.push('clear'); return { rows: [] }; }
    assert.equal(cleared, true); cleared = false; polls += 1; calls.push('activity'); assert.deepEqual(values, [42]);
    return { rowCount: polls === 2 ? 1 : 0 };
  } } });
  assert.deepEqual(calls, ['clear', 'activity', 'clear', 'activity']); operation.release();
});

test('an operation failing during snapshot refresh stops observation before the next read', async () => {
  const operation = createFixtureGate(); const failure = new Error('Controlled transaction failure before wait'); let reads = 0;
  await assert.rejects(waitForFixturePostgresBlock({ holderPid: 42, operation: operation.promise,
    queryable: { query: async () => { reads += 1; operation.abort(failure); await setImmediate(); return { rows: [] }; } },
  }), (error) => error === failure);
  assert.equal(reads, 1);
});
