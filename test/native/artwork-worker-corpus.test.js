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
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';
import { artworkCorpusCases, createArtworkCorpusInput } from '../../testing/server/artwork-corpus-inputs.js';

const profile = await artworkWorkerCgroup({ memoryBytes: 1024 ** 3, cpus: 1 });
const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = fileURLToPath(new URL('../../testing/server/artwork-memory-fixture.js', import.meta.url));
const limits = { maxOriginalFileSizeBytes: 100 * 1024 * 1024, maxOriginalDimensionPixels: 8192 };

for (const spec of artworkCorpusCases) test(`native corpus ${spec.id} preserves policy, content and publication ownership`, async t => {
  const before = await profile.snapshot(); const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-corpus-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = await createArtworkCorpusInput(spec);
  const metadata = await sharp(input, { limitInputPixels: 8192 ** 2 }).metadata();
  assert.equal(metadata.width, spec.width); assert.equal(metadata.height, spec.height); assert.equal(metadata.channels, spec.channels);
  assert.equal(metadata.depth, spec.bits === 16 ? 'ushort' : 'uchar');
  if (spec.format === 'jpeg') assert.ok(metadata.exif?.length, 'Native input contains real synthetic EXIF metadata');
  if (spec.format === 'png') assert.equal(metadata.bitsPerSample, spec.bits);
  if (spec.noise && spec.format === 'png') assert.ok(input.length > spec.width * spec.height * spec.channels * (spec.bits / 8), 'Actual incompressible pixel samples');
  let childRecord; let diagnostic = ''; let publications = 0;
  const worker = createArtworkWorkerService({ spawnFn: (file, args, options) => {
    const index = args.findIndex(value => value.endsWith('/artwork-image-worker.js')); assert.ok(index >= 0);
    const childArgs = spec.refuse ? args : [...args.slice(0, index), fixture, ...args.slice(index + 1), 'observe'];
    const child = spawn(file, childArgs, { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
    childRecord = { pid: child.pid, closed: false, code: null, signal: null };
    child.stderr.on('data', part => { assert.ok(diagnostic.length + part.length <= 4096); diagnostic += part; });
    child.once('close', (code, signal) => { Object.assign(childRecord, { closed: true, code, signal }); }); return child;
  } });
  const service = createArtworkIngestionService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits, storage: { root } }) },
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: worker.processArtworkBuffer }),
    getArtworkAssetBySha256Fn: async () => { if (spec.refuse) assert.fail('No publication lookup after capacity refusal'); return null; },
    upsertArtworkAssetFn: async asset => { publications++; return { ...asset, id: spec.id }; },
  });
  const started = performance.now(); let output;
  if (spec.refuse) {
    await assert.rejects(service.ingestArtworkBuffer({ buffer: input }), { code: 'artwork_worker_memory', status: 503 });
    assert.equal(publications, 0); assert.deepEqual(await readdir(root), []);
  } else {
    const result = await service.ingestArtworkBuffer({ buffer: input }); output = await readFile(result.absolutePath);
    assert.equal(publications, 1); assert.equal(result.asset.sha256, hash(output)); assert.equal(result.asset.payloadChecksum, hash(input));
    const rewritten = await sharp(output).metadata();
    assert.equal(rewritten.format, spec.format); assert.equal(rewritten.width, spec.width); assert.equal(rewritten.height, spec.height);
    assert.equal(rewritten.depth, 'uchar'); assert.equal(rewritten.hasAlpha, spec.channels === 4);
    assert.equal(rewritten.exif, undefined); assert.equal(rewritten.icc, undefined); assert.equal(rewritten.xmp, undefined);
    if (spec.format === 'png') {
      assert.equal(rewritten.bitsPerSample, 8);
      const originalPixels = await sharp(input).raw().toBuffer(); const outputPixels = await sharp(output).raw().toBuffer();
      assert.equal(hash(outputPixels), hash(originalPixels), 'Preserve the canonical decoded 8-bit pixel projection');
    }
    const report = diagnostic.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)).find(value => value.kind === 'processed');
    assert.ok(report); assert.equal(report.dataLimitBytes, 1024 ** 3); assert.ok(report.maxRssKiB > 0);
    t.diagnostic(JSON.stringify({ id: spec.id, inputBytes: input.length, outputBytes: output.length, inputDepth: metadata.depth,
      inputBits: spec.bits, channels: spec.channels, outputSha256: hash(output), ...report, elapsedMs: performance.now() - started }));
  }
  assert.equal(childRecord.closed, true); assert.throws(() => process.kill(childRecord.pid, 0), { code: 'ESRCH' });
  assert.equal(childRecord.signal, null); assert.equal(childRecord.code, spec.refuse ? 1 : 0);
  const after = await profile.snapshot(); assert.equal(after.oomKills, before.oomKills);
  t.diagnostic(JSON.stringify({ id: spec.id, publications, refusal: Boolean(spec.refuse), retiredChild: true, kernel: after,
    scope: 'whole corpus container peak includes fixture generation, previous cases, test parent and children' }));
});
