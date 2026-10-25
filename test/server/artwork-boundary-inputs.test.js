/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { boundaryArtworkCases, selectBoundaryArtworkCase } from '../../testing/server/artwork-boundary-cases.js';
import { loadBoundaryArtworkInput } from '../../testing/server/artwork-boundary-inputs.js';
import { readPinnedArtworkFile } from '../../testing/server/artwork-pinned-file.js';
import { prepareBoundaryArtworkInputs } from '../../testing/server/artwork-boundary-preparation.js';
import { assertArtworkMemoryAdmission, artworkWorkerMemoryEstimate, ARTWORK_WORKER_DATA_LIMIT } from '../../src/server/artwork/artwork-worker-memory.js';

test('fixed admitted inputs are inside the shared budget and unknown descriptors cannot load arbitrary files', async () => {
  for (const spec of boundaryArtworkCases) {
    const metadata = { ...spec, depth: 'uchar' };
    assert.equal(selectBoundaryArtworkCase(spec.id), spec); assertArtworkMemoryAdmission({ metadata, inputBytes: spec.inputBytes });
    const headroom = ARTWORK_WORKER_DATA_LIMIT - artworkWorkerMemoryEstimate(metadata, spec.inputBytes);
    assert.ok(headroom > 0 && headroom < 2 * 1024 ** 2); assert.ok(Object.isFrozen(spec));
  }
  for (const id of [null, undefined, '', 'foreign']) assert.throws(() => selectBoundaryArtworkCase(id), TypeError);
  await assert.rejects(loadBoundaryArtworkInput({ ...boundaryArtworkCases[0] }), TypeError);
});

test('pinned file reads require exact bytes, digest, EOF and regular-file ownership', async t => {
  const parent = resolve(tmpdir()); const root = await mkdtemp(join(parent, 'harmoniarr-pinned-test-'));
  t.after(async () => { assert.equal(dirname(root), parent); assert.ok(basename(root).startsWith('harmoniarr-pinned-test-')); await rm(root, { recursive: true, force: true }); });
  const bytes = Buffer.from('fixture'); const fileName = 'fixture.jpg'; const path = join(root, fileName);
  const options = { root, fileName, inputBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  let handle;
  const owned = { openFileFn: async (...args) => { handle = await open(...args); return handle; } };
  await writeFile(path, bytes); assert.deepEqual(await readPinnedArtworkFile(options, owned), bytes); assert.equal(handle.fd, -1);
  for (const content of [Buffer.from('changed'), bytes.subarray(1), Buffer.concat([bytes, Buffer.from('x')])]) {
    await writeFile(path, content); await assert.rejects(readPinnedArtworkFile(options, owned)); assert.equal(handle.fd, -1);
  }
  await writeFile(path, bytes);
  await assert.rejects(readPinnedArtworkFile({ ...options, signal: AbortSignal.abort(null) }), error => error === null);
  const controller = new AbortController();
  await assert.rejects(readPinnedArtworkFile({ ...options, signal: controller.signal }, {
    openFileFn: async (...args) => { handle = await open(...args); controller.abort(null); return handle; },
  }), error => error === null); assert.equal(handle.fd, -1);
  for (const file of ['../fixture.jpg', 'fixture.png', '/fixture.jpg']) await assert.rejects(readPinnedArtworkFile({ ...options, fileName: file }), TypeError);
  await mkdir(join(root, 'directory.jpg')); await assert.rejects(readPinnedArtworkFile({ ...options, fileName: 'directory.jpg' }));
  assert.deepEqual(await readPinnedArtworkFile(options), bytes, 'Refused reads retire their file handles');
});

test('preparation refuses existing output directories without altering their content', async t => {
  const parent = resolve(tmpdir()); const root = await mkdtemp(join(parent, 'harmoniarr-prepare-test-'));
  t.after(async () => { assert.equal(dirname(root), parent); assert.ok(basename(root).startsWith('harmoniarr-prepare-test-')); await rm(root, { recursive: true, force: true }); });
  const path = join(root, 'keep'); await writeFile(path, 'original');
  await assert.rejects(prepareBoundaryArtworkInputs({ root }), { code: 'EEXIST' });
  assert.equal(await readFile(path, 'utf8'), 'original');
  await assert.rejects(prepareBoundaryArtworkInputs({ root, signal: AbortSignal.abort(null) }), error => error === null);
});
