/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixturePhaseObserver, createIntegrationFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';

test('fixture phases preserve results and errors while measuring approved outcomes with a monotonic clock', async () => {
  const records = []; const ticks = [10, 17, 20, 31, 35, 40];
  const observer = createFixturePhaseObserver({ onRecord: (record) => records.push(record), now: () => ticks.shift() });
  const value = { retained: true }; const failure = new Error('postgres://private:password@hidden/db?token=secret');
  assert.equal(await observer.measure('schema_prepare', () => value), value);
  await assert.rejects(observer.measure('scenario_work', () => { throw failure; }), (error) => error === failure);
  await assert.rejects(observer.measure('fixture_seed', () => { throw new DOMException('Secret cancellation', 'AbortError'); }), { name: 'AbortError' });
  assert.deepEqual(records.map(({ phase, outcome, durationMs, sequence }) => ({ phase, outcome, durationMs, sequence })), [
    { phase: 'schema_prepare', outcome: 'passed', durationMs: 7, sequence: 1 },
    { phase: 'scenario_work', outcome: 'failed', durationMs: 11, sequence: 2 },
    { phase: 'fixture_seed', outcome: 'cancelled', durationMs: 5, sequence: 3 },
  ]);
  assert.equal(new Set(records.map((record) => record.correlationId)).size, 1);
  assert.ok(records.every(Object.isFrozen));
  assert.equal(JSON.stringify(records).includes('private'), false);
  assert.equal(JSON.stringify(records).includes('Secret'), false);
});

test('fixture child observations have separate identity and accounting under their owning runtime', async () => {
  const records = []; let now = 0;
  const root = createFixturePhaseObserver({ onRecord: (record) => records.push(record), now: () => now++ });
  const first = root.child(); const second = root.child();
  await root.measure('container_start', async () => {});
  await first.measure('database_create', async () => {});
  await second.measure('database_create', async () => {});
  assert.equal(records[1].parentId, records[0].correlationId);
  assert.equal(records[2].parentId, records[0].correlationId);
  assert.notEqual(records[1].correlationId, records[2].correlationId);
  assert.deepEqual(records.map((record) => record.sequence), [1, 1, 1]);
});

test('optional observation failures never replace the measured operation result or original error', async () => {
  const failure = new Error('Controlled primary'); const sinkFailure = new Error('Controlled sink');
  for (const onRecord of [() => { throw sinkFailure; }, () => Promise.reject(sinkFailure)]) {
    const observer = createFixturePhaseObserver({ onRecord });
    assert.equal(await observer.measure('scenario_work', () => 42), 42);
    await assert.rejects(observer.measure('scenario_work', () => { throw failure; }), (error) => error === failure);
  }
  await new Promise((resolve) => { setImmediate(resolve); });
});

test('disabled phase collection performs no clock or sink work and preserves the operation', async () => {
  const observer = createFixturePhaseObserver({ enabled: false,
    now: () => { assert.fail('Disabled clock'); }, onRecord: () => { assert.fail('Disabled sink'); } });
  assert.equal(await observer.measure('scenario_work', () => 7), 7);
});

test('invalid clocks omit unreliable phase evidence without changing the operation', async () => {
  for (const now of [() => NaN, () => { throw new Error('Clock unavailable'); }, (() => { let value = 3; return () => value--; })()]) {
    const records = []; const observer = createFixturePhaseObserver({ now, onRecord: (record) => records.push(record) });
    assert.equal(await observer.measure('schema_prepare', () => 9), 9);
    assert.deepEqual(records, []);
  }
});

test('phase names and correlation inputs refuse unsafe arbitrary labels before recording', async () => {
  for (const options of [{ correlationId: 'private-database' }, { parentId: 'private-path' }, { onRecord: {} }, { enabled: 'yes' }]) {
    assert.throws(() => createFixturePhaseObserver(options), TypeError);
  }
  const observer = createFixturePhaseObserver();
  await assert.rejects(observer.measure('password=secret', () => assert.fail('Invalid phase ran')), TypeError);
});

test('phase environment opt-in is explicit and only emits the approved record', async () => {
  for (const value of [undefined, '', '0', 'false', '1', 'true']) {
    const records = []; const observer = createIntegrationFixturePhaseObserver({
      env: { HARMONIARR_INTEGRATION_PHASE_TIMINGS: value, PGPASSWORD: 'private-password' },
      onRecord: (record) => records.push(record),
    });
    await observer.measure('schema_prepare', async () => {});
    assert.equal(records.length, value === '1' || value === 'true' ? 1 : 0);
    assert.equal(JSON.stringify(records).includes('private-password'), false);
  }
  assert.throws(() => createIntegrationFixturePhaseObserver({ env: { HARMONIARR_INTEGRATION_PHASE_TIMINGS: 'maybe' } }), TypeError);
});
