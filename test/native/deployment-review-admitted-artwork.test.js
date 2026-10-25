/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { assertArtworkMemoryAdmission, artworkWorkerMemoryEstimate, ARTWORK_WORKER_DATA_LIMIT } from '../../src/server/artwork/artwork-worker-memory.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { selectBoundaryArtworkCase } from '../../testing/server/artwork-boundary-cases.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
const spec = selectBoundaryArtworkCase(process.env.HARMONIARR_REVIEW_ARTWORK_CASE);
assert.equal(process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, '/boundary-inputs');
const mount = (await readFile('/proc/self/mountinfo', 'utf8')).split('\n').find(line => line.split(' ')[4] === '/boundary-inputs');
assert.ok(mount?.split(' ')[5].split(',').includes('ro'), 'Require an explicit read-only prepared fixture mount');
const metadata = { ...spec, depth: 'uchar' };
assertArtworkMemoryAdmission({ metadata, inputBytes: spec.inputBytes });
const estimate = artworkWorkerMemoryEstimate(metadata, spec.inputBytes);
assert.ok(ARTWORK_WORKER_DATA_LIMIT - estimate > 0 && ARTWORK_WORKER_DATA_LIMIT - estimate < 2 * 1024 ** 2);

test(`admitted mixed artwork: ${spec.id}`, { timeout: 120_000 }, async t => {
  t.after(closePool);
  const result = await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal, artworkCaseId: spec.id });
  const artwork = result.result.artworkCase;
  t.diagnostic(JSON.stringify({ ...result, childEstimateBytes: estimate, childEstimateHeadroomBytes: ARTWORK_WORKER_DATA_LIMIT - estimate }));
  assert.equal(artwork.containedNativeFailures, 0, 'Native abort cannot qualify an admitted input');
  assert.ok(artwork.refusals.every(row => row.code !== 'artwork_worker_memory'), 'The fixed input must reach processing admission');
});
