import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { isArtworkAdmissionError } from '../../src/server/artwork/artwork-fetch-admission.js';

test('ingestion admission bounds aggregate queued bytes and returns reservations at handoff', async () => {
  const gate = createArtworkIngestionAdmission({ concurrency: 1, maxQueuedBytes: 10 });
  const held = Promise.withResolvers(); const order = [];
  const active = gate.run(() => held.promise, { weight: 100 });
  const first = gate.run(() => { order.push(1); }, { weight: 6 });
  const second = gate.run(() => { order.push(2); }, { weight: 4 });
  try {
    await assert.rejects(gate.run(() => assert.fail(), { weight: 1 }), error => {
      assert.equal(error.code, 'artwork_ingestion_capacity'); assert.equal(error.status, 503);
      assert.equal(isArtworkAdmissionError(error), true); return true;
    });
    assert.deepEqual(gate.getState(), { active: 1, queued: 2, queuedBytes: 10 });
  } finally { held.resolve(); await Promise.allSettled([active, first, second]); }
  assert.deepEqual(order, [1, 2]); assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
});

test('queued cancellation and timeout restore byte capacity without admitting cancelled work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = createArtworkIngestionAdmission({ concurrency: 1, maxQueuedBytes: 10, queueTimeoutMs: 10 });
  const held = Promise.withResolvers(); const active = gate.run(() => held.promise);
  const controller = new AbortController();
  const cancelled = gate.run(() => assert.fail(), { weight: 10, signal: controller.signal });
  const check = assert.rejects(cancelled, { code: 'artwork_ingestion_cancelled' }); controller.abort(); await check;
  const timed = gate.run(() => assert.fail(), { weight: 10 });
  const timedCheck = assert.rejects(timed, { code: 'artwork_ingestion_capacity' });
  t.mock.timers.tick(10); await timedCheck;
  assert.deepEqual(gate.getState(), { active: 1, queued: 0, queuedBytes: 0 });
  held.resolve(); await active;
});

test('ingestion admission bounds zero-byte file waiters and validates weight/policy', async () => {
  const gate = createArtworkIngestionAdmission({ concurrency: 1, maxQueued: 1 });
  const held = Promise.withResolvers(); const active = gate.run(() => held.promise); const file = gate.run(() => 'file');
  try { await assert.rejects(gate.run(() => assert.fail()), { code: 'artwork_ingestion_capacity' }); }
  finally { held.resolve(); await Promise.allSettled([active, file]); }
  for (const weight of [-1, Infinity, NaN, 1.5]) await assert.rejects(gate.run(() => {}, { weight }), TypeError);
  for (const maxQueuedBytes of [-1, Infinity, 1.5]) assert.throws(() => createArtworkIngestionAdmission({ maxQueuedBytes }), TypeError);
});
