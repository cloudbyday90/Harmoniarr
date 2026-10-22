import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { maximumByteArtworkPng } from '../../testing/server/artwork-worker-inputs.js';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';

assert.equal(process.platform, 'linux', 'Run this explicit maximum-policy lane in the documented constrained Linux container');
const kernelValue = async name => (await readFile(`/sys/fs/cgroup/${name}`, 'utf8')).trim();
let cgroupVersion = 2; let memoryLimit;
try { memoryLimit = await kernelValue('memory.max'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  cgroupVersion = 1; memoryLimit = await kernelValue('memory/memory.limit_in_bytes');
}
assert.equal(memoryLimit, '1073741824', 'Use the explicit 1 GiB cgroup profile');
if (cgroupVersion === 2) {
  assert.equal(await kernelValue('memory.swap.max'), '0', 'Disable additional swap in this profile');
  assert.equal(await kernelValue('pids.max'), '96');
  const [quota, period] = (await kernelValue('cpu.max')).split(' ').map(Number);
  assert.equal(quota / period, 1);
} else {
  assert.equal(await kernelValue('memory/memory.memsw.limit_in_bytes'), memoryLimit, 'Memory plus swap must equal the memory limit');
  assert.equal(await kernelValue('pids/pids.max'), '96');
  assert.equal(Number(await kernelValue('cpu/cpu.cfs_quota_us')) / Number(await kernelValue('cpu/cpu.cfs_period_us')), 1);
}
const maxBytes = 100 * 1024 * 1024;
const limits = { maxOriginalFileSizeBytes: maxBytes, maxOriginalDimensionPixels: 8192 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixturePath = fileURLToPath(new URL('../../testing/server/artwork-worker-fixture.js', import.meta.url));
let maximumJpegPromise;
function maximumJpeg() {
  maximumJpegPromise ??= sharp({ create: { width: 8192, height: 8192, channels: 3, background: 'red' } }).jpeg().toBuffer();
  return maximumJpegPromise;
}

function observedWorker({ mode, timeoutMs = 15_000, controller } = {}) {
  const observations = []; const outputSeen = Promise.withResolvers();
  const worker = createArtworkWorkerService({ timeoutMs, spawnFn: (file, args, options) => {
    const workerIndex = args.findIndex(value => value.endsWith('/artwork-image-worker.js'));
    assert.ok(workerIndex >= 0);
    const child = spawn(file, mode ? [...args.slice(0, workerIndex), fixturePath, ...args.slice(workerIndex + 1), mode] : args, options);
    const record = { pid: child.pid, output: 0, closed: false }; observations.push(record);
    child.stdout.on('data', chunk => { record.output += chunk.length; outputSeen.resolve(); controller?.abort(); });
    child.once('close', (code, signal) => { Object.assign(record, { closed: true, code, signal }); });
    return child;
  } });
  return { ...worker, observations, outputSeen: outputSeen.promise };
}
function assertRetired(worker) {
  assert.ok(worker.observations.length > 0);
  for (const child of worker.observations) {
    assert.equal(child.closed, true);
    assert.throws(() => process.kill(child.pid, 0), { code: 'ESRCH' });
  }
}

test('maximum byte input uses actual child rewrite and parent-owned publication with exact output', async t => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-worker-max-bytes-')); t.after(() => rm(root, { recursive: true, force: true }));
  const { input, png } = await maximumByteArtworkPng(maxBytes);
  const worker = observedWorker(); let writes = 0;
  const service = createArtworkIngestionService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => { writes++; return { ...asset, id: 'max-byte' }; },
  });
  const result = await service.ingestArtworkBuffer({ buffer: input });
  const stored = await readFile(result.absolutePath); const expected = await sharp(png).png({ compressionLevel: 9 }).toBuffer();
  assert.equal(hash(stored), hash(expected)); assert.equal(result.asset.payloadChecksum, hash(input));
  assert.equal(result.asset.sha256, hash(stored)); assert.equal(result.asset.width, 16); assert.equal(writes, 1); assertRetired(worker);
  await assert.rejects(service.ingestArtworkBuffer({ buffer: Buffer.alloc(maxBytes + 1) }), { code: 'artwork_file_too_large' });
  assert.equal(worker.observations.length, 1); assert.equal(writes, 1);
  t.diagnostic(JSON.stringify({ inputBytes: input.length, outputBytes: stored.length, outputSha256: hash(stored), closedChildren: 1 }));
});

test('maximum pixel policy processes a real 8192-square JPEG and refuses the first excessive dimension', async t => {
  const worker = observedWorker();
  const input = await maximumJpeg();
  const result = await worker.processArtworkBuffer({ buffer: input, maxBytes, maxDimensionPixels: 8192 });
  assert.equal(result.width, 8192); assert.equal(result.height, 8192); assert.equal(result.format, 'jpeg');
  const metadata = await sharp(result.data).metadata(); assert.equal(metadata.width, 8192); assert.equal(metadata.height, 8192);
  const excessive = await sharp({ create: { width: 8193, height: 1, channels: 3, background: 'red' } }).jpeg().toBuffer();
  await assert.rejects(worker.processArtworkBuffer({ buffer: excessive, maxBytes, maxDimensionPixels: 8192 }), { code: 'artwork_dimensions_too_large' });
  assertRetired(worker);
  t.diagnostic(JSON.stringify({ inputBytes: input.length, outputBytes: result.data.length, outputSha256: hash(result.data), pixels: 8192 ** 2, closedChildren: 2 }));
});

for (const mode of ['hang', 'cancel', 'crash', 'native-active']) {
  test(`actual child ${mode} cannot publish; retirement precedes slot release`, async t => {
    const controller = new AbortController(); const gate = createArtworkIngestionAdmission({ concurrency: 1 });
    const cancelling = mode === 'cancel' || mode === 'native-active';
    const worker = observedWorker({ mode: ['crash', 'native-active'].includes(mode) ? mode : 'hang', timeoutMs: mode === 'hang' ? 3000 : 15_000,
      controller: cancelling ? controller : null });
    let publications = 0;
    const input = mode === 'native-active' ? await maximumJpeg()
      : await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
    const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
      artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root: '/never-publish' } }) },
      prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
      getArtworkAssetBySha256Fn: async () => { publications++; return null; }, mkdirFn: async () => { publications++; },
      writeFileFn: async () => { publications++; }, upsertArtworkAssetFn: async () => { publications++; },
    });
    const code = `artwork_worker_${mode === 'hang' ? 'timeout' : cancelling ? 'cancelled' : 'failed'}`;
    await assert.rejects(service.ingestArtworkBuffer({ buffer: input, signal: controller.signal }), { code, status: 503 });
    assert.equal(worker.observations[0].output > 0, true, 'actual child protocol activity arrived before refusal');
    if (mode === 'native-active') assert.equal(worker.observations[0].output, 1, 'native-active prefix arrived before the image result');
    assert.equal(publications, 0); assertRetired(worker);
    assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
    t.diagnostic(JSON.stringify({ mode, refusalCode: code, publications, ...worker.observations[0] }));
  });
}

test('default ingestion succeeds while native input loaders are blocked in the parent', async t => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-worker-default-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
  sharp.block({ operation: ['VipsForeignLoad'] });
  try {
    await assert.rejects(sharp(input).metadata());
    const service = createArtworkIngestionService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
      getArtworkAssetBySha256Fn: async () => null, upsertArtworkAssetFn: async asset => ({ ...asset, id: 'default-worker' }) });
    const result = await service.ingestArtworkBuffer({ buffer: input });
    const bytes = await readFile(result.absolutePath);
    assert.equal(result.asset.sha256, hash(bytes)); assert.equal(result.asset.width, 16); assert.equal(result.stored, true);
  } finally { sharp.unblock({ operation: ['VipsForeignLoad'] }); }
  const peak = await kernelValue(cgroupVersion === 2 ? 'memory.peak' : 'memory/memory.max_usage_in_bytes');
  t.diagnostic(JSON.stringify({ cgroupVersion, containerMemoryPeakBytes: Number(peak),
    containerMemoryLimitBytes: 1073741824, scope: 'whole qualification container, including fixture generation and all children' }));
});
