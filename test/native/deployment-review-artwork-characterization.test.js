/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentArtworkBoundaryProfile } from '../../testing/server/deployment-artwork-boundary-profile.js';
import { qualifyDeploymentReviewMemory } from '../../testing/server/deployment-review-qualification.js';

const { gib, profile, spec, estimate, headroom, admitted } = await requireDeploymentArtworkBoundaryProfile();
assert.equal(admitted, true, 'Characterize an input inside numeric admission');

test(`characterize admitted artwork without asserting publication: ${spec.id}`, { timeout: 120_000 }, async t => {
  t.after(closePool);
  const result = await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal, artworkCaseId: spec.id });
  const artwork = result.result.artworkCase;
  const processingQualified = result.result.images === 2 && artwork.refusals.length === 0;
  t.diagnostic(JSON.stringify({ ...result, childEstimateBytes: estimate, childEstimateHeadroomBytes: headroom,
    qualification: 'bounded-outcome-characterization', processingQualified }));
  assert.equal(artwork.containedNativeFailures, 0, 'Native abort is not a controlled outcome');
  assert.equal(artwork.timeoutTerminations, 0, 'Characterization requires normal worker retirement');
  assert.ok(artwork.workerResults.every(row => row.signal === null && [0, 1].includes(row.code)));
  assert.ok(artwork.refusals.every(row => row.status === 503 && ['artwork_worker_failed', 'artwork_worker_memory', 'artwork_ingestion_capacity'].includes(row.code)));
});
