/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertArtworkMemoryAdmission, artworkWorkerMemoryEstimate, ARTWORK_WORKER_DATA_LIMIT } from '../../src/server/artwork/artwork-worker-memory.js';
import { selectBoundaryArtworkCase } from './artwork-boundary-cases.js';
import { requireDeploymentMemoryProfile } from './deployment-memory-profile.js';

/** Refuse undeclared profiles and mutable input mounts before acquiring a pool. */
export async function requireDeploymentArtworkBoundaryProfile() {
  const { gib, profile } = await requireDeploymentMemoryProfile();
  const spec = selectBoundaryArtworkCase(process.env.HARMONIARR_REVIEW_ARTWORK_CASE);
  assert.equal(process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, '/boundary-inputs');
  const mount = (await readFile('/proc/self/mountinfo', 'utf8')).split('\n').find(line => line.split(' ')[4] === '/boundary-inputs');
  assert.ok(mount?.split(' ')[5].split(',').includes('ro'), 'Require an explicit read-only prepared fixture mount');
  const metadata = { ...spec, depth: 'uchar' }; const estimate = artworkWorkerMemoryEstimate(metadata, spec.inputBytes);
  const headroom = ARTWORK_WORKER_DATA_LIMIT - estimate; const admitted = spec.expectedAdmission === 'admitted';
  if (admitted) {
    assertArtworkMemoryAdmission({ metadata, inputBytes: spec.inputBytes });
    assert.ok(headroom > 0 && headroom < spec.maxAdmissionHeadroomBytes);
  } else {
    assert.throws(() => assertArtworkMemoryAdmission({ metadata, inputBytes: spec.inputBytes }), { code: 'artwork_worker_memory', status: 503 });
    assert.ok(headroom < 0);
  }
  return { gib, profile, spec, estimate, headroom, admitted };
}
