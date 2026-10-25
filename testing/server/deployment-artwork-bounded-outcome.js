/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { isArtworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';
import { isWorkAdmissionError } from '../../src/server/work-admission.js';

export function assertOwnedMaximumArtworkRefusal(error) {
  const worker = isArtworkWorkerError(error) && error.status === 503 && ['artwork_worker_memory', 'artwork_worker_failed', 'artwork_worker_timeout'].includes(error.code);
  const outputPolicy = error instanceof Error && error.status === 400 && error.code === 'artwork_output_too_large';
  const admission = isWorkAdmissionError(error) && error.status === 503 && error.code === 'artwork_ingestion_capacity';
  assert.ok(worker || outputPolicy || admission, 'Require an owned admission/processing or explicit output-byte refusal');
}
/** Containment is distinct from a graceful refusal; never infer its native cause. */
export function classifyMaximumArtworkWorkers(children, refusals) {
  const count = code => refusals.filter(row => row.code === code).length;
  const timeouts = children.filter(child => ['SIGTERM', 'SIGKILL'].includes(child.signal)).length;
  const aborts = children.filter(child => child.signal === 'SIGABRT').length;
  assert.ok(timeouts <= count('artwork_worker_timeout'), 'A killed child needs an owned timeout');
  assert.ok(aborts <= count('artwork_worker_failed'), 'An aborted child needs an owned failed result');
  for (const child of children) {
    assert.ok(child.closed);
    if (child.signal) assert.ok(['SIGTERM', 'SIGKILL', 'SIGABRT'].includes(child.signal), 'Unqualified native termination');
    else assert.ok([0, 1].includes(child.code));
  }
  return { containedNativeFailures: aborts, timeoutTerminations: timeouts };
}
/** Admission maxima need safe per-job outcomes, including mixed success/refusal. */
export async function settleBoundedDeploymentArtwork({ pool, image, artworkCase, owners, tasks, published, release, gate,
  children, getPolicy, getDownloads, getPublicationLookups, checkpoint }) {
  const completed = Promise.allSettled(tasks); let held = false; let publicationReservedBytes = 0;
  const boundary = await Promise.race([published.promise.then(() => 'publication'), completed.then(() => 'settled')]);
  try {
    if (boundary === 'publication') {
      held = true; publicationReservedBytes = gate.getMemoryState().reservedBytes; assert.ok(publicationReservedBytes > 0);
      assert.ok(children.some(child => child.closed)); await checkpoint('publication');
    }
  } finally { release.resolve(); }
  const settled = await completed; const hashes = []; const assetIds = new Set(); const expectedPaths = new Set(); const refusals = [];
  const root = getPolicy().storage.root; const inputHash = createHash('sha256').update(image).digest('hex');
  for (let index = 0; index < settled.length; index++) {
    const result = settled[index]; const assigned = (await pool.query('SELECT artwork_asset_id FROM artwork_assignments WHERE owner_id=$1', [owners[index]])).rows;
    if (result.status === 'rejected') { assertOwnedMaximumArtworkRefusal(result.reason); assert.equal(assigned.length, 0); refusals.push({ job: index, code: result.reason.code, status: result.reason.status }); continue; }
    assert.equal(result.value.sourceProvider, 'fanartTv'); assert.equal(assigned.length, 1); assert.equal(assigned[0].artwork_asset_id, result.value.assetId);
    const row = (await pool.query('SELECT id,sha256,relative_path,payload_checksum FROM artwork_assets WHERE id=$1', [result.value.assetId])).rows[0];
    const output = await readFile(join(root, row.relative_path)); assert.equal(createHash('sha256').update(output).digest('hex'), row.sha256); assert.equal(row.payload_checksum, inputHash);
    await artworkCase.verifyOutput(output); hashes.push(row.sha256); assetIds.add(row.id); expectedPaths.add(row.relative_path);
  }
  const images = hashes.length; assert.equal(getPublicationLookups(), images); assert.equal(held, images > 0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count, assetIds.size);
  let files; try { files = await readdir(root, { recursive: true, withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
  const actualPaths = files.filter(file => file.isFile()).map(file => relative(root, join(file.parentPath, file.name))).sort();
  assert.deepEqual(actualPaths, [...expectedPaths].sort()); assert.ok(new Set(hashes).size <= 1);
  const capacityRefusals = refusals.filter(row => row.code === 'artwork_ingestion_capacity').length;
  assert.equal(getDownloads(), owners.length); assert.equal(children.length, owners.length - capacityRefusals);
  assert.ok(children.length > 0, 'At least one actual decoder must exercise the maximum input'); assert.ok(children.every(child => child.closed));
  const termination = classifyMaximumArtworkWorkers(children, refusals);
  return { images, assignments: images, outputSha256: hashes[0] ?? null, publicationReservedBytes,
    artworkCase: { ...artworkCase.evidence, ...termination,
      outcome: termination.containedNativeFailures ? 'contained-native-failure' : images === owners.length ? 'published' : images === 0 ? 'refused' : 'mixed',
      refusalCount: refusals.length, refusals, publicationLookups: getPublicationLookups(), closedWorkers: children.length,
      workerResults: children.map(({ code, signal }) => ({ code, signal })) } };
}
