/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { maximumArtworkCases } from '../../testing/server/artwork-maximum-inputs.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
const spec = maximumArtworkCases.find(item => item.id === process.env.HARMONIARR_REVIEW_ARTWORK_CASE);
assert.ok(spec, 'Select an owned maximum artwork case before pool acquisition');
test(`maximum mixed artwork refuses combined memory cost: ${spec.id}`, { timeout: 180_000 }, async t => {
  t.after(closePool);
  const result = await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal, artworkCaseId: spec.id });
  const artwork = result.result.artworkCase;
  assert.equal(result.result.images, 0); assert.equal(artwork.containedNativeFailures, 0); assert.equal(artwork.timeoutTerminations, 0);
  assert.ok(artwork.refusals.some(row => row.code === 'artwork_worker_memory'));
  assert.ok(artwork.refusals.every(row => ['artwork_worker_memory', 'artwork_ingestion_capacity'].includes(row.code)));
  assert.ok(artwork.workerResults.every(row => row.code === 1 && row.signal === null));
  assert.ok(artwork.workerResults.every(row => row.outputBytes === Buffer.byteLength('{"failure":"memory"}\n')),
    'The real worker must refuse before its metadata/grant handshake or any output body');
  t.diagnostic(JSON.stringify(result));
});
