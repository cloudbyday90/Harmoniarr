import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkIngestionService } from '../../src/server/artwork/artwork-ingestion-service.js';
import { decodedArtworkMemoryReservation, initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';

const small = { width: 8, height: 8, channels: 3, depth: 'uchar' };
const large = { width: 8192, height: 8192, channels: 3, depth: 'uchar' };

test('metadata reductions admit small jobs without exposing expansion or double release', async () => {
  const gate = createArtworkIngestionAdmission(); const held = Promise.withResolvers(); let reservation; let started = false;
  const first = gate.run(value => { reservation = value; return held.promise; }, { inputBytes: 5 });
  const next = gate.run(() => { started = true; }, { inputBytes: 5 });
  try {
    assert.equal(started, false); assert.equal(gate.getMemoryState().reservedBytes, initialArtworkMemoryReservation(5));
    reservation.onMetadata(small); assert.equal(started, true); await next;
    assert.equal(gate.getMemoryState().reservedBytes, decodedArtworkMemoryReservation(small, 5));
    assert.throws(() => reservation.onMetadata(large), TypeError);
    assert.throws(() => reservation.onMetadata(small, 6), TypeError);
  } finally { held.resolve(); await Promise.allSettled([first, next]); }
  assert.equal(gate.getMemoryState().reservedBytes, 0); assert.throws(() => reservation.onMetadata(small), TypeError);
});

test('a retired large worker retains the reservation through publication and prevents queued file intake', async () => {
  const gate = createArtworkIngestionAdmission(); const entered = Promise.withResolvers(); const held = Promise.withResolvers();
  let reads = 0; let prepared = 0; let publications = 0;
  const buffer = Buffer.from('input'); const root = '/owned';
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits: {}, storage: { root } }) },
    readFileFn: async () => { reads++; return buffer; },
    prepareArtworkAssetFn: async options => { prepared++; options.onMetadata(prepared === 1 ? large : small);
      return { data: buffer, asset: { sha256: 'a'.repeat(64), relativePath: 'originals/image.png' } }; },
    getArtworkAssetBySha256Fn: async () => null, mkdirFn: async () => {}, writeFileFn: async () => {},
    upsertArtworkAssetFn: async asset => { publications++; if (publications === 1) { entered.resolve(); await held.promise; } return asset; },
  });
  const first = service.ingestArtworkBuffer({ buffer }); await entered.promise;
  const second = service.ingestArtworkFile({ filePath: '/queued' });
  try {
    assert.equal(reads, 0); assert.equal(prepared, 1); assert.equal(publications, 1);
    assert.deepEqual(gate.getState(), { active: 1, queued: 1, queuedBytes: 0 });
    assert.equal(gate.getMemoryState().reservedBytes, decodedArtworkMemoryReservation(large, buffer.length));
  } finally { held.resolve(); await Promise.allSettled([first, second]); }
  await first; await second; assert.equal(reads, 1); assert.equal(publications, 2); assert.equal(gate.getMemoryState().reservedBytes, 0);
});

test('memory-blocked buffer waiters preserve byte/cancellation bounds without acquiring a reservation', async () => {
  const gate = createArtworkIngestionAdmission({ maxQueuedBytes: 5 }); const held = Promise.withResolvers();
  const first = gate.run(() => held.promise, { inputBytes: 5 }); const controller = new AbortController();
  const second = gate.run(() => assert.fail(), { inputBytes: 5, weight: 5, signal: controller.signal });
  const cancelled = assert.rejects(second, { code: 'artwork_ingestion_cancelled' });
  try {
    await assert.rejects(gate.run(() => assert.fail(), { inputBytes: 1, weight: 1 }), { code: 'artwork_ingestion_capacity' });
    controller.abort(); await cancelled; assert.equal(gate.getMemoryState().reservedBytes, initialArtworkMemoryReservation(5));
  } finally { held.resolve(); await Promise.allSettled([first, second]); }
  assert.equal(gate.getMemoryState().reservedBytes, 0);
});

test('an insufficient configured budget refuses before policy, file intake or preparation', async () => {
  const gate = createArtworkIngestionAdmission({ memoryBudgetBytes: 1 });
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => assert.fail('no policy query') },
    readFileFn: async () => assert.fail('no intake'), prepareArtworkAssetFn: async () => assert.fail('no preparation') });
  await assert.rejects(service.ingestArtworkBuffer({ buffer: Buffer.from('input') }), { code: 'artwork_ingestion_capacity', status: 503 });
  await assert.rejects(service.ingestArtworkFile({ filePath: '/never-read' }), { code: 'artwork_ingestion_capacity', status: 503 });
  assert.equal(gate.getMemoryState().reservedBytes, 0);
  for (const memoryBudgetBytes of [0, -1, 1.5, Infinity]) assert.throws(() => createArtworkIngestionAdmission({ memoryBudgetBytes }), TypeError);
});
