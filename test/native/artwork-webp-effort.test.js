/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, statfs, writeFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';
import { readDeploymentMemory } from '../../testing/server/deployment-memory-observer.js';
import { loadBoundaryArtworkInput } from '../../testing/server/artwork-boundary-inputs.js';
import { readPinnedArtworkFile } from '../../testing/server/artwork-pinned-file.js';
import { webpEffortInput } from '../../testing/server/webp-effort-cases.js';
import { selectWebpRewriteCase } from '../../testing/server/webp-lossless-cases.js';
import { inspectLosslessWebpContainer } from '../../testing/server/webp-lossless-container.js';
import { compareWebpEffort } from '../../testing/server/webp-effort-comparison.js';

await artworkWorkerCgroup({ memoryBytes: 3 * 1024 ** 3, cpus: 2, pids: 96 });
const mode = process.env.HARMONIARR_WEBP_COMPARISON_MODE ?? 'lossy';
const spec = selectWebpRewriteCase(Number(process.env.HARMONIARR_WEBP_COMPARISON_EFFORT), process.env.HARMONIARR_WEBP_COMPARISON_SCOPE, mode);
const input = spec.input ?? webpEffortInput;
assert.equal(process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, '/boundary-inputs');
const mounts = (await readFile('/proc/self/mountinfo', 'utf8')).split('\n').map(line => line.split(' '));
assert.ok(mounts.some(row => row[4] === '/boundary-inputs' && row[5].split(',').includes('ro')));
assert.ok(mounts.some(row => row[4] === '/qualification' && row[5].split(',').includes('rw')));
const temporary = await statfs('/tmp');
assert.equal(temporary.blocks * temporary.bsize, 256 * 1024 ** 2, 'Match the existing native temporary-filesystem profile');
assert.ok(mounts.some(row => row[4] === '/tmp' && row[5].split(',').includes('rw') && row.includes('tmpfs')));
assert.deepEqual(await readdir('/qualification'), [], 'Require a fresh explicit output directory');

test(`WebP encoder comparison: ${spec.id}`, { timeout: 60_000 }, async t => {
  const before = await readDeploymentMemory();
  const image = spec.input ? await readPinnedArtworkFile({ root: process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, ...input, signal: t.signal })
    : (await loadBoundaryArtworkInput(webpEffortInput, { signal: t.signal })).image;
  const inputFacts = spec.lossless ? inspectLosslessWebpContainer(image) : null;
  const { data, observation } = await compareWebpEffort({ buffer: image, effort: spec.effort, scope: spec.scope, mode, signal: t.signal });
  let outputSha256 = null; let outputFacts = null;
  if (data) {
    const metadata = await sharp(data).metadata(); assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, spec.width); assert.equal(metadata.height, spec.height);
    for (const field of ['exif', 'icc', 'xmp']) assert.equal(metadata[field], undefined);
    if (spec.lossless) {
      outputFacts = inspectLosslessWebpContainer(data); assert.equal(metadata.hasAlpha, false);
      assert.deepEqual(outputFacts.chunks, ['VP8L']); assert.equal(outputFacts.width, spec.width); assert.equal(outputFacts.height, spec.height);
      assert.equal(inputFacts.width, spec.width); assert.equal(inputFacts.height, spec.height);
    }
    outputSha256 = createHash('sha256').update(data).digest('hex');
    await writeFile('/qualification/output.webp', data, { flag: 'wx' });
    assert.equal(createHash('sha256').update(await readFile('/qualification/output.webp')).digest('hex'), outputSha256);
  }
  assert.deepEqual(await readdir('/qualification'), data ? ['output.webp'] : []);
  const after = await readDeploymentMemory(); assert.deepEqual(after.events, before.events);
  const evidence = { ...observation, inputSha256: input.sha256, inputBytes: image.length, outputSha256,
    width: spec.width, height: spec.height, kernelBefore: before, kernelAfter: after,
    temporaryFilesystemBytes: temporary.blocks * temporary.bsize,
    metricsIncludedInEncoderMeasurement: false, applicationPublicationQualified: false, inputFacts, outputFacts };
  await writeFile('/qualification/result.json', JSON.stringify(evidence, null, 2), { flag: 'wx' });
  t.diagnostic(JSON.stringify(evidence));
});
