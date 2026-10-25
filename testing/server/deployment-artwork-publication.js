/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { settleBoundedDeploymentArtwork } from './deployment-artwork-bounded-outcome.js';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Publication and expected capacity refusal retain different proof obligations. */
export async function settleDeploymentArtwork({ pool, image, artworkCase, dimension, maximumBytes, owners, tasks,
  published, downloaded, release, gate, children, getPolicy, getDownloads, getPublicationLookups, checkpoint }) {
  if (artworkCase?.spec.boundedOutcome) return settleBoundedDeploymentArtwork({ pool, image, artworkCase, owners, tasks,
    published, release, gate, children, getPolicy, getDownloads, getPublicationLookups, checkpoint });
  const refusal = artworkCase?.spec.refuse === true; const jobs = owners.length;
  let publicationReservedBytes = 0; const hashes = []; let images = 0;
  if (refusal) {
    const settled = await Promise.allSettled(tasks);
    for (const result of settled) {
      assert.equal(result.status, 'rejected'); assert.equal(result.reason?.code, 'artwork_worker_memory'); assert.equal(result.reason?.status, 503);
    }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count, 0);
    let files;
    try { files = await readdir(getPolicy().storage.root, { recursive: true, withFileTypes: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
    assert.equal(files.filter(file => file.isFile()).length, 0);
  } else {
    const completed = Promise.all(tasks);
    try {
      await Promise.race([Promise.all([published.promise, downloaded.promise]), completed.then(() => assert.fail('Publication hold was bypassed'))]);
      assert.equal(Number((await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name='hx_memory_work' AND wait_event='advisory'")).rows[0].count), 2);
      assert.ok(gate.getMemoryState().reservedBytes > 0); assert.ok(children.some(child => child.closed));
      publicationReservedBytes = gate.getMemoryState().reservedBytes;
      if (!artworkCase && dimension === 8192) { assert.equal(children.length, 1); assert.equal(gate.getState().queued, 1); }
      await checkpoint('publication');
    } finally { release.resolve(); }
    const results = await completed; images = results.length;
    for (const result of results) {
      assert.equal(result.sourceProvider, 'fanartTv');
      const row = (await pool.query('SELECT sha256,relative_path,payload_checksum FROM artwork_assets WHERE id=$1', [result.assetId])).rows[0];
      const output = await readFile(join(getPolicy().storage.root, row.relative_path));
      assert.equal(hash(output), row.sha256); assert.equal(row.payload_checksum, hash(image)); hashes.push(row.sha256);
      if (artworkCase) await artworkCase.verifyOutput(output);
      else { const metadata = await sharp(output).metadata(); assert.equal(metadata.width, dimension); assert.equal(metadata.height, dimension); }
    }
    assert.equal(new Set(hashes).size, 1);
    if (!artworkCase && dimension === 8192) assert.equal(hashes[0], '6cd962b9433503f386017ab370eaf43b2524abc7cd1e6abf501b540d79630576');
    if (maximumBytes) assert.equal(hashes[0], '0201a304652d5c7a872673cecb170e186c87d763b39e8f8ddf3961a6ed77da1a');
  }
  const assignments = (await pool.query('SELECT count(*)::int AS count FROM artwork_assignments WHERE owner_id=ANY($1::uuid[])', [owners])).rows[0].count;
  assert.equal(assignments, refusal ? 0 : jobs); assert.equal(getDownloads(), jobs); assert.equal(children.length, jobs);
  for (const child of children) { assert.equal(child.closed, true); assert.equal(child.code, refusal ? 1 : 0); assert.equal(child.signal, null); }
  return { images, assignments, outputSha256: hashes[0] ?? null, publicationReservedBytes,
    ...(artworkCase ? { artworkCase: { ...artworkCase.evidence, refusalCount: refusal ? jobs : 0, closedWorkers: children.length } } : {}) };
}
