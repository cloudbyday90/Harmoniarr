/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchemaMaintenanceService } from '../../src/server/schema-maintenance-service.js';

const summary = { state: 'current', checkedAt: '2026-10-27T00:00:00.000Z', lineage: { state: 'current' }, anchors: { state: 'current', checkedCount: 164 } };
test('maintenance starts automatically, stores one detached summary and only checks again when due', async () => {
  let time = 0, calls = 0, tick, stopped = 0;
  const service = createSchemaMaintenanceService({ now: () => time, intervalMs: 100, retryMs: 10,
    diagnosticsService: { getSchemaDiagnostics: async () => { calls++; return summary; }, waitForDrain: async () => true },
    createRunnerFn: options => { tick = options.onTick; return { start: () => tick(), tick: () => tick(), stop: () => { stopped++; } }; } });
  assert.equal(service.getSchemaDiagnostics().state, 'pending'); assert.equal(calls, 0);
  await service.start(); assert.equal(calls, 1); assert.equal(service.getSchemaDiagnostics().state, 'current');
  service.getSchemaDiagnostics().anchors.checkedCount = 0; assert.equal(service.getSchemaDiagnostics().anchors.checkedCount, 164);
  await service.tick(); assert.equal(calls, 1); time = 100;
  assert.equal(service.getSchemaDiagnostics().state, 'stale'); await service.tick(); assert.equal(calls, 2);
  await service.stopAndDrain(); assert.equal(stopped, 1); await service.tick(); service.start(); assert.equal(calls, 2);
});

test('paused, busy and unavailable maintenance are retried by cadence without HTTP-driven work', async () => {
  for (const state of ['paused', 'busy', 'unavailable']) {
    let time = 0, calls = 0;
    const service = createSchemaMaintenanceService({ now: () => time, intervalMs: 100, retryMs: 10,
      diagnosticsService: { getSchemaDiagnostics: async () => { calls++; return { state }; }, waitForDrain: async () => true } });
    await service.tick(); assert.equal(service.getSchemaDiagnostics().state, state);
    for (let i = 0; i < 20; i++) service.getSchemaDiagnostics(); assert.equal(calls, 1);
    time = 9; await service.tick(); assert.equal(calls, 1); time = 10; await service.tick(); assert.equal(calls, 2);
    await service.stopAndDrain();
  }
});

test('shutdown cancels the owner but waits for actual drainage, with no overlapping maintenance admission', async () => {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(); let signal, calls = 0, finished = false;
  const service = createSchemaMaintenanceService({ diagnosticsService: {
    getSchemaDiagnostics: options => { signal = options.signal; calls++; return result.promise; }, waitForDrain: () => drain.promise,
  } });
  const running = service.tick(); await service.tick(); assert.equal(calls, 1);
  const closing = service.stopAndDrain(); closing.then(() => { finished = true; }); assert.equal(signal.aborted, true);
  result.resolve({ state: 'unavailable' }); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(finished, false);
  assert.equal(service.stopAndDrain(), closing); drain.resolve(true); await closing; await running;
  await service.tick(); assert.equal(calls, 1);
});

test('uncertain native retirement seals future maintenance and refuses successful shutdown', async () => {
  let calls = 0;
  const service = createSchemaMaintenanceService({ diagnosticsService: {
    getSchemaDiagnostics: async () => { calls++; return summary; }, waitForDrain: async () => false,
  } });
  await service.tick(); assert.equal(service.getSchemaDiagnostics().state, 'unavailable');
  await service.tick(); assert.equal(calls, 1); await assert.rejects(service.stopAndDrain(), /retirement is uncertain/u);
});
