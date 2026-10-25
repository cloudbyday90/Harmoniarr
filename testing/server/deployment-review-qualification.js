/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDeploymentMemoryWorkload } from './deployment-memory-workload.js';
import { withDeploymentMediaFixture } from './deployment-media-fixture.js';
import { createDeploymentMediaObserver } from './deployment-media-observer.js';
import { withDeploymentMediaWorkers } from './deployment-media-workers.js';
import { createDeploymentReviewObserver, runDeploymentReviewConcurrently } from './deployment-review-observer.js';
import { withDeploymentReviewWorkload } from './deployment-review-workload.js';
import { readDeploymentMemory } from './deployment-memory-observer.js';
import { maximumArtworkCases } from './artwork-maximum-inputs.js';
import { boundaryArtworkCases } from './artwork-boundary-cases.js';

/** Guarded entries own the pool/profile; every case shares the same actual workload. */
export async function qualifyDeploymentReviewMemory({ pool, profile, gib, signal, artworkCaseId = null, artworkFixtureFactory = null }) {
  if (artworkFixtureFactory !== null && typeof artworkFixtureFactory !== 'function') throw new TypeError('Invalid mixed artwork fixture factory');
  const backend = (await pool.query(`SELECT pg_backend_pid() AS pid,current_setting('server_version_num')::int AS version,
    pg_size_bytes(current_setting('shared_buffers'))::text AS sharedBuffersBytes,
    pg_size_bytes(current_setting('work_mem'))::text AS workMemBytes,current_setting('hash_mem_multiplier')::float AS hashMultiplier,
    current_setting('max_connections')::int AS maxConnections`)).rows[0];
  assert.ok(backend.version >= 180000 && backend.version < 190000);
  assert.equal(await readFile(`/proc/${backend.pid}/cgroup`, 'utf8'), await readFile('/proc/self/cgroup', 'utf8'));
  const { pid: _pid, ...databaseSettings } = backend; const before = await profile.snapshot(); const beforeFixture = await readDeploymentMemory();
  const measurement = await withDeploymentMediaFixture(async fixture => {
    const observation = createDeploymentReviewObserver({ mediaObserver: createDeploymentMediaObserver({ signal }) });
    const artworkFixture = artworkFixtureFactory?.({ mediaObserver: observation.observer, signal });
    const holdScanUntilArtwork = Boolean(artworkFixture) || [...maximumArtworkCases, ...boundaryArtworkCases].some(spec => spec.id === artworkCaseId);
    return runDeploymentMemoryWorkload({ pool, dimension: 8192, callerBytes: 256 * 1024 ** 2, artworkCaseId, artworkFixture, signal,
      onArtworkSpawn: () => {
        observation.observer.observeArtworkSpawn();
        if (holdScanUntilArtwork && !artworkFixture) observation.observer.releaseScan();
      },
      withConcurrentWork: (context, work) => withDeploymentReviewWorkload({ ...context, observation, signal }, review =>
        withDeploymentMediaWorkers({ ...context, fixture, observer: observation.observer, holdScanUntilArtwork }, () => runDeploymentReviewConcurrently(work, review))),
    });
  });
  const after = await profile.snapshot(); const afterFixture = await readDeploymentMemory();
  assert.deepEqual(afterFixture.events, beforeFixture.events, 'Fixture generation and cleanup must also avoid kernel limit/OOM events');
  assert.equal(after.oomKills, before.oomKills); assert.ok(after.memoryPeakBytes < gib * 1024 ** 3);
  const { baseline, settled } = measurement.checkpoints;
  assert.equal(settled.kernel.events.max, baseline.kernel.events.max); assert.equal(settled.kernel.events.oom, baseline.kernel.events.oom);
  assert.equal(measurement.result.finalReservedBytes, 0); assert.equal(measurement.result.review.detailNativeOverlap, true);
  return { scenario: artworkFixtureFactory ? 'review-webp-selection' : artworkCaseId == null ? 'review-media' : 'review-artwork-corpus', memoryGiB: gib, node: process.versions.node,
    database: { ...databaseSettings, appPoolMax: pool.options.max }, ...measurement, afterFixtureKernelPeakBytes: after.memoryPeakBytes, oomKillsUnchanged: true,
    fixtureKernelEvents: { before: beforeFixture.events, after: afterFixture.events },
    scope: 'selected controlled single-app workload; lifetime peak includes setup; native overlap is lifecycle evidence; transcode writes only null output; durations are observations, not an SLO' };
}
