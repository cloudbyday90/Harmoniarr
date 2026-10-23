import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { maximumByteArtworkPng } from '../../testing/server/artwork-worker-inputs.js';
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';

const profile = await artworkWorkerCgroup({ memoryBytes: 3 * 1024 ** 3, cpus: 2 });
const oomKills = async () => (await profile.snapshot()).oomKills;
const fixturePath = fileURLToPath(new URL('../../testing/server/artwork-memory-fixture.js', import.meta.url));
const limits = { maxOriginalFileSizeBytes: 100 * 1024 * 1024, maxOriginalDimensionPixels: 8192 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function observedWorker(mode) {
  const records = []; let active = 0; let peakActive = 0;
  const worker = createArtworkWorkerService({ spawnFn: (file, args, options) => {
    const index = args.findIndex(value => value.endsWith('/artwork-image-worker.js')); assert.ok(index >= 0);
    const child = spawn(file, [...args.slice(0, index), fixturePath, ...args.slice(index + 1), mode], { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    const record = { pid: child.pid, closed: false, output: 0, diagnostic: '' }; records.push(record); active++; peakActive = Math.max(peakActive, active);
    child.stdout.on('data', chunk => { record.output += chunk.length; });
    child.stderr.on('data', chunk => { assert.ok(record.diagnostic.length + chunk.length <= 4096); record.diagnostic += chunk; });
    child.once('close', (code, signal) => { active--; Object.assign(record, { closed: true, code, signal }); }); return child;
  } });
  return { ...worker, records, peakActive: () => peakActive };
}
function retired(worker) {
  for (const child of worker.records) { assert.equal(child.closed, true); assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' }); }
}
const reports = row => row.diagnostic.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));

test('real native Buffer allocation refusal after valid output cannot publish or kill the parent', async t => {
  const beforeOom = await oomKills(); const parentPid = process.pid; const worker = observedWorker('allocate');
  const gate = createArtworkIngestionAdmission({ concurrency: 1 }); let publications = 0;
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-memory-refusal-')); t.after(() => rm(root, { recursive: true, force: true }));
  const input = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => { publications++; return null; },
    upsertArtworkAssetFn: async () => { publications++; },
  });
  await assert.rejects(service.ingestArtworkBuffer({ buffer: input }), { code: 'artwork_worker_failed', status: 503 });
  assert.equal(publications, 0); assert.deepEqual(await readdir(root), []); assert.equal(process.pid, parentPid);
  assert.equal(await oomKills(), beforeOom); assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 }); retired(worker);
  const row = worker.records[0]; assert.ok(row.output > 100); assert.equal(row.code, 7); assert.equal(row.signal, null);
  const allocation = reports(row).find(value => value.kind === 'allocation-refused'); assert.ok(allocation);
  assert.ok(allocation.allocatedBytes > 512 * 1024 * 1024); assert.ok(allocation.allocatedBytes < allocation.dataLimitBytes);
  t.diagnostic(JSON.stringify({ ...allocation, parentSurvived: true, oomKillsUnchanged: true, publications }));
  // A fresh default worker still succeeds after the refused child has retired.
  const next = await createArtworkWorkerService().processArtworkBuffer({ buffer: input, maxBytes: limits.maxOriginalFileSizeBytes, maxDimensionPixels: 8192 });
  assert.equal(next.width, 16);
});

test('two concurrent maximum-byte jobs retain exact hashes within their individual DATA limits', async t => {
  const beforeOom = await oomKills(); const worker = observedWorker('observe');
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-memory-pair-')); t.after(() => rm(root, { recursive: true, force: true }));
  const { input } = await maximumByteArtworkPng(limits.maxOriginalFileSizeBytes);
  let publications = 0;
  const service = createArtworkIngestionService({ artworkIngestionAdmission: createArtworkIngestionAdmission({ memoryBudgetBytes: 3 * 1024 ** 3 }),
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => { publications++; return { ...asset, id: 'paired' }; },
  });
  const settled = await Promise.allSettled([service.ingestArtworkBuffer({ buffer: input }), service.ingestArtworkBuffer({ buffer: input })]);
  retired(worker);
  for (const item of settled) {
    assert.equal(item.status, 'fulfilled', JSON.stringify({ code: item.reason?.code, children: worker.records.map(row => ({ code: row.code, signal: row.signal, reports: reports(row) })) }));
    const result = item.value;
    assert.equal(result.asset.width, 16); assert.equal(result.asset.height, 16); assert.equal(result.asset.payloadChecksum, hash(input));
    assert.equal(hash(await readFile(result.absolutePath)), '0201a304652d5c7a872673cecb170e186c87d763b39e8f8ddf3961a6ed77da1a');
  }
  assert.equal(publications, 2); assert.equal(worker.peakActive(), 2); assert.equal(await oomKills(), beforeOom); retired(worker);
  t.diagnostic(JSON.stringify({ publications, concurrentChildren: worker.peakActive(), children: worker.records.flatMap(reports),
    containerMemoryPeakBytes: (await profile.snapshot()).memoryPeakBytes,
    scope: 'whole qualification container, including fixture generation and earlier allocation control', oomKillsUnchanged: true }));
});

test('default worker refuses combined maximum bytes and pixels as capacity before publication', async t => {
  const beforeOom = await oomKills(); const records = []; let publications = 0;
  const worker = createArtworkWorkerService({ spawnFn: (...args) => {
    const child = spawn(...args); const record = { pid: child.pid, closed: false, frame: '' }; records.push(record);
    child.stdout.on('data', chunk => { assert.ok(record.frame.length + chunk.length <= 1024); record.frame += chunk; });
    child.once('close', () => { record.closed = true; }); return child;
  } });
  const jpeg = await sharp({ create: { width: 8192, height: 8192, channels: 3, background: 'red' } }).jpeg().toBuffer();
  // Valid JPEG plus inert trailing padding combines both configured maxima.
  const input = Buffer.alloc(limits.maxOriginalFileSizeBytes); jpeg.copy(input);
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-memory-combined-')); t.after(() => rm(root, { recursive: true, force: true }));
  const service = createArtworkIngestionService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => { publications++; return null; }, upsertArtworkAssetFn: async () => { publications++; },
  });
  await assert.rejects(service.ingestArtworkBuffer({ buffer: input }), { code: 'artwork_worker_memory', status: 503 });
  retired({ records }); assert.equal(records.length, 1); assert.equal(records[0].frame, '{"failure":"memory"}\n');
  assert.equal(publications, 0); assert.deepEqual(await readdir(root), []); assert.equal(await oomKills(), beforeOom);
  t.diagnostic(JSON.stringify({ inputBytes: input.length, pixels: 8192 ** 2, publications, refusal: 'artwork_worker_memory', oomKillsUnchanged: true }));
});

test('default aggregate reservation serializes maximum-pixel children through held publication', async t => {
  const beforeOom = await oomKills(); const worker = observedWorker('observe'); const gate = createArtworkIngestionAdmission();
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-memory-aggregate-')); t.after(() => rm(root, { recursive: true, force: true }));
  const input = await sharp({ create: { width: 8192, height: 8192, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const entered = Promise.withResolvers(); const held = Promise.withResolvers(); let publications = 0;
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => {
      publications++; if (publications === 1) { entered.resolve(); await held.promise; } return { ...asset, id: 'aggregate' };
    },
  });
  const tasks = [service.ingestArtworkBuffer({ buffer: input }), service.ingestArtworkBuffer({ buffer: input })];
  try {
    await Promise.race([entered.promise, Promise.all(tasks).then(() => assert.fail('Publication hold was bypassed'))]);
    assert.equal(worker.records.length, 1); assert.equal(worker.records[0].closed, true);
    assert.equal(gate.getState().queued, 1); assert.equal(gate.getState().active, 1);
    assert.ok(gate.getMemoryState().reservedBytes > 1024 ** 3); assert.ok(gate.getMemoryState().reservedBytes <= gate.getMemoryState().budgetBytes);
  } finally { held.resolve(); await Promise.allSettled(tasks); }
  for (const result of await Promise.all(tasks)) assert.equal(hash(await readFile(result.absolutePath)), '6cd962b9433503f386017ab370eaf43b2524abc7cd1e6abf501b540d79630576');
  assert.equal(publications, 2); assert.equal(worker.peakActive(), 1); assert.equal(await oomKills(), beforeOom); retired(worker);
  assert.equal(gate.getMemoryState().reservedBytes, 0);
  t.diagnostic(JSON.stringify({ defaultBudgetBytes: gate.getMemoryState().budgetBytes, maximumConcurrentChildren: worker.peakActive(),
    publications, childRetirementBeforePublicationRelease: true, finalReservedBytes: 0, oomKillsUnchanged: true }));
});
