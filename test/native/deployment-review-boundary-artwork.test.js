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

test(`boundary mixed artwork: ${spec.id} (${spec.expectedAdmission})`, { timeout: 120_000 }, async t => {
  t.after(closePool);
  const result = await qualifyDeploymentReviewMemory({ pool: getPool(), profile, gib, signal: t.signal, artworkCaseId: spec.id });
  const artwork = result.result.artworkCase;
  t.diagnostic(JSON.stringify({ ...result, childEstimateBytes: estimate, childEstimateHeadroomBytes: headroom }));
  assert.equal(artwork.containedNativeFailures, 0, 'Native abort cannot qualify a boundary input');
  if (admitted) {
    assert.equal(result.result.images, 2, 'Require both selected admitted images to publish');
    assert.equal(artwork.refusals.length, 0); assert.ok(artwork.workerResults.every(row => row.code === 0 && row.signal === null));
  } else {
    assert.equal(result.result.images, 0); assert.equal(artwork.timeoutTerminations, 0);
    assert.ok(artwork.refusals.some(row => row.code === 'artwork_worker_memory'));
    assert.ok(artwork.refusals.every(row => ['artwork_worker_memory', 'artwork_ingestion_capacity'].includes(row.code)));
    assert.ok(artwork.workerResults.every(row => row.code === 1 && row.signal === null && row.outputBytes === 21),
      'Refuse before metadata/grant or an output body');
  }
});
