import assert from 'node:assert/strict';
import test from 'node:test';
import { closePool, getPool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { runDeploymentMemoryWorkload } from '../../testing/server/deployment-memory-workload.js';
import { withDeploymentMediaFixture } from '../../testing/server/deployment-media-fixture.js';
import { createDeploymentMediaObserver } from '../../testing/server/deployment-media-observer.js';
import { withDeploymentMediaWorkers } from '../../testing/server/deployment-media-workers.js';

const { gib, profile } = await requireDeploymentMemoryProfile();
test('shared-container media memory: real catalogue scan, FFprobe and encoding overlap artwork and SQL', { timeout: 90_000 }, async t => {
  t.after(closePool); const pool = getPool(); const before = await profile.snapshot();
  const artworkCloses = []; let measurement;
  try { measurement = await withDeploymentMediaFixture(async fixture => {
    const observer = createDeploymentMediaObserver({ signal: t.signal });
    return runDeploymentMemoryWorkload({ pool, dimension: 8192, callerBytes: 256 * 1024 ** 2,
      onArtworkSpawn: () => observer.observeArtworkSpawn(),
      onArtworkClose: event => artworkCloses.push(event),
      withConcurrentWork: (context, work) => withDeploymentMediaWorkers({ ...context, fixture, observer }, work),
    });
  }); } catch (error) {
    try {
      const kernel = await profile.snapshot();
      t.diagnostic(JSON.stringify({ failureEvidence: 'media-scan', artworkCloses, memoryPeakBytes: kernel.memoryPeakBytes, oomKills: kernel.oomKills }));
    } catch { /* Retain the original workload failure through optional diagnostics. */ }
    throw error;
  }
  const afterFixture = await profile.snapshot(); assert.equal(afterFixture.oomKills, before.oomKills);
  assert.ok(afterFixture.memoryPeakBytes < gib * 1024 ** 3);
  const { baseline, settled } = measurement.checkpoints;
  assert.equal(settled.kernel.events.max, baseline.kernel.events.max); assert.equal(settled.kernel.events.oom, baseline.kernel.events.oom);
  assert.ok(settled.kernel.lifetimePeakBytes < gib * 1024 ** 3); assert.equal(measurement.result.finalReservedBytes, 0);
  t.diagnostic(JSON.stringify({ scenario: 'media-scan', memoryGiB: gib, ...measurement, afterFixtureKernelPeakBytes: afterFixture.memoryPeakBytes, oomKillsUnchanged: true,
    scope: 'controlled 64-file selection and real workers; transcode encodes to null; overlap is lifecycle evidence, not simultaneous maximum CPU or memory' }));
});
