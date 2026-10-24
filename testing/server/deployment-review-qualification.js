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

/** Guarded entries own the pool/profile; every case shares the same actual workload. */
export async function qualifyDeploymentReviewMemory({ pool, profile, gib, signal, artworkCaseId = null }) {
  const backend = (await pool.query(`SELECT pg_backend_pid() AS pid,current_setting('server_version_num')::int AS version,
    pg_size_bytes(current_setting('shared_buffers'))::text AS sharedBuffersBytes,
    pg_size_bytes(current_setting('work_mem'))::text AS workMemBytes,current_setting('hash_mem_multiplier')::float AS hashMultiplier,
    current_setting('max_connections')::int AS maxConnections`)).rows[0];
  assert.ok(backend.version >= 180000 && backend.version < 190000);
  assert.equal(await readFile(`/proc/${backend.pid}/cgroup`, 'utf8'), await readFile('/proc/self/cgroup', 'utf8'));
  const { pid: _pid, ...databaseSettings } = backend; const before = await profile.snapshot();
  const measurement = await withDeploymentMediaFixture(async fixture => {
    const observation = createDeploymentReviewObserver({ mediaObserver: createDeploymentMediaObserver({ signal }) });
    return runDeploymentMemoryWorkload({ pool, dimension: 8192, callerBytes: 256 * 1024 ** 2, artworkCaseId,
      onArtworkSpawn: () => observation.observer.observeArtworkSpawn(),
      withConcurrentWork: (context, work) => withDeploymentReviewWorkload({ ...context, observation, signal }, review =>
        withDeploymentMediaWorkers({ ...context, fixture, observer: observation.observer }, () => runDeploymentReviewConcurrently(work, review))),
    });
  });
  const after = await profile.snapshot(); assert.equal(after.oomKills, before.oomKills); assert.ok(after.memoryPeakBytes < gib * 1024 ** 3);
  const { baseline, settled } = measurement.checkpoints;
  assert.equal(settled.kernel.events.max, baseline.kernel.events.max); assert.equal(settled.kernel.events.oom, baseline.kernel.events.oom);
  assert.equal(measurement.result.finalReservedBytes, 0); assert.equal(measurement.result.review.detailNativeOverlap, true);
  return { scenario: artworkCaseId == null ? 'review-media' : 'review-artwork-corpus', memoryGiB: gib, node: process.versions.node,
    database: { ...databaseSettings, appPoolMax: pool.options.max }, ...measurement, afterFixtureKernelPeakBytes: after.memoryPeakBytes, oomKillsUnchanged: true,
    scope: 'selected controlled single-app workload; lifetime peak includes setup; native overlap is lifecycle evidence; transcode writes only null output; durations are observations, not an SLO' };
}
