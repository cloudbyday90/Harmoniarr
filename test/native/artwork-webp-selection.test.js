/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { getPool, closePool } from '../../src/server/database.js';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { getArtworkAssetBySha256 } from '../../src/server/artwork/artwork-repository.js';
import { initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { readDeploymentMemory } from '../../testing/server/deployment-memory-observer.js';
import { readPinnedArtworkFile } from '../../testing/server/artwork-pinned-file.js';
import { selectWebpSelectionCase } from '../../testing/server/webp-selection-cases.js';
import { measureRgb8Error } from '../../testing/server/webp-quality-metrics.js';
const { gib } = await requireDeploymentMemoryProfile();
const spec = selectWebpSelectionCase(process.env.HARMONIARR_SELECTION_CASE);
const scenario = process.env.HARMONIARR_SELECTION_SCENARIO ?? 'publish'; assert.ok(['publish', 'cancel'].includes(scenario));
assert.equal(process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, '/boundary-inputs');
assert.ok((await readFile('/proc/self/mountinfo', 'utf8')).split('\n').some(line => { const fields = line.split(' '); return fields[4] === '/boundary-inputs' && fields[5].split(',').includes('ro'); }));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = '/app/data/artwork-selection'; const files = async () => { try { return (await readdir(root, { recursive: true, withFileTypes: true })).filter(row => row.isFile()); } catch (error) { if (error.code !== 'ENOENT') throw error; return []; } };

test(`production WebP ${scenario}: ${spec.input.id} (${gib} GiB)`, { timeout: 60_000 }, async t => {
  t.after(closePool); const pool = getPool(); const before = await readDeploymentMemory();
  const image = await readPinnedArtworkFile({ ...spec.input, root: '/boundary-inputs', signal: t.signal });
  const gate = createArtworkIngestionAdmission(); const records = []; const headers = []; const tasks = [];
  const release = Promise.withResolvers(); const ready = Promise.withResolvers(); const controller = new AbortController(); let lookups = 0; let nativeCancellation = null;
  const worker = createArtworkWorkerService({ spawnFn: (file, args, options) => {
    if (scenario === 'cancel') {
      const index = args.findIndex(value => value.endsWith('artwork-image-worker.js')); assert.ok(index >= 0);
      args = [...args.slice(0, index), fileURLToPath(new URL('../../testing/server/artwork-worker-fixture.js', import.meta.url)), ...args.slice(index + 1), 'native-active'];
    }
    const child = spawn(file, args, options); const record = { pid: child.pid, closed: false }; records.push(record);
    if (scenario === 'cancel') child.stdout.on('data', bytes => { if (bytes.toString() !== ' ' || nativeCancellation) return;
      nativeCancellation = { beforeAbort: gate.getMemoryState().reservedBytes, childClosed: record.closed };
      controller.abort(); nativeCancellation.afterAbort = gate.getMemoryState().reservedBytes;
    });
    child.once('close', (code, signal) => Object.assign(record, { closed: true, code, signal })); return child;
  } });
  const service = createArtworkIngestionService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits: { maxOriginalFileSizeBytes: 100 * 1024 ** 2, maxOriginalDimensionPixels: 8192 }, storage: { root } }) },
    artworkIngestionAdmission: gate,
    prepareArtworkAssetFn: options => prepareArtworkAsset({ ...options, transformArtworkBufferFn: request => worker.processArtworkBuffer({ ...request, onMetadata: value => { headers.push(value); request.onMetadata?.(value); } }) }),
    getArtworkAssetBySha256Fn: async digest => { assert.equal(scenario, 'publish'); lookups++; if (lookups === 1) { ready.resolve(); await release.promise; } return getArtworkAssetBySha256(digest); },
  });
  let heldBytes = 0; let results = []; let pixelError = null;
  try {
    const first = service.ingestArtworkBuffer({ buffer: image, sourceProvider: 'embedded', signal: AbortSignal.any([t.signal, controller.signal]) }); tasks.push(first);
    if (scenario === 'cancel') {
      await assert.rejects(first, { code: 'artwork_worker_cancelled', status: 503 });
      assert.ok(nativeCancellation); assert.equal(nativeCancellation.childClosed, false);
      assert.equal(nativeCancellation.beforeAbort, initialArtworkMemoryReservation(image.length)); assert.equal(nativeCancellation.afterAbort, nativeCancellation.beforeAbort);
      assert.equal(lookups, 0); assert.equal((await pool.query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count, 0); assert.equal((await files()).length, 0);
    } else {
      await Promise.race([ready.promise, first.then(() => assert.fail('Publication hold bypassed'))]);
      assert.equal(records.length, 1); assert.equal(records[0].closed, true); assert.equal(headers[0].webpSelection, true);
      heldBytes = gate.getMemoryState().reservedBytes; assert.equal(heldBytes, initialArtworkMemoryReservation(image.length));
      tasks.push(service.ingestArtworkBuffer({ buffer: image, sourceProvider: 'embedded', signal: t.signal }));
      await new Promise(resolve => { setImmediate(resolve); }); assert.equal(gate.getState().queued, 1); assert.equal(records.length, 1);
      release.resolve(); results = await Promise.all(tasks); assert.equal(records.length, 2); assert.ok(headers.every(value => value.webpSelection === true));
      assert.equal(results[0].stored, true); assert.equal(results[1].stored, false);
      for (const result of results) {
        const data = await readFile(result.absolutePath); assert.equal(data.length, spec.outputBytes); assert.equal(hash(data), spec.outputSha256);
        const asset = await getArtworkAssetBySha256(spec.outputSha256); assert.equal(asset.payloadChecksum, spec.input.sha256); assert.equal(asset.fileSizeBytes, data.length);
        const meta = await sharp(data).metadata(); assert.equal(meta.width, spec.input.width); assert.equal(meta.height, spec.input.height);
        for (const key of ['exif', 'icc', 'xmp']) assert.equal(meta[key], undefined);
        if (spec.lossless) pixelError = measureRgb8Error(await sharp(image).raw().toBuffer(), await sharp(data).raw().toBuffer());
      }
      if (spec.lossless) assert.equal(pixelError.identical, true);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count, 1); assert.equal((await files()).length, 1);
    }
  } finally { release.resolve(); await Promise.allSettled(tasks); }
  for (const record of records) { assert.equal(record.closed, true); assert.throws(() => process.kill(record.pid, 0), { code: 'ESRCH' }); }
  assert.equal(gate.getMemoryState().reservedBytes, 0); assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 });
  const after = await readDeploymentMemory(); assert.deepEqual(after.events, before.events);
  t.diagnostic(JSON.stringify({ scenario, case: spec.input.id, gib, inputSha256: spec.input.sha256, inputBytes: image.length, selectedSha256: results[0]?.asset.sha256 ?? null, outputBytes: results[0]?.asset.fileSizeBytes ?? 0,
    lossless: spec.lossless, pixelError, heldBytes, finalReservedBytes: 0, headers, records, nativeCancellation, databaseRows: scenario === 'publish' ? 1 : 0, files: (await files()).length, kernelBefore: before, kernelAfter: after, metricsIncludedInKernelPeak: true }));
});
