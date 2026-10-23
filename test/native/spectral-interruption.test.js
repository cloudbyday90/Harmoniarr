import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { withDeploymentMediaFixture } from '../../testing/server/deployment-media-fixture.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';
import { createSourceUserSpectralCacheStore } from '../../src/server/activity/source-user-spectral-cache-store.js';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';
import { createMediaSpectralProofService } from '../../src/server/media/media-spectral-proof-service.js';
import { createFileContentHasher } from '../../src/server/media/file-content-hasher.js';
import { createFfmpegSpectralAnalyzer } from '../../src/server/media/ffmpeg-spectral-analyzer.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';

await requireDeploymentMemoryProfile(); after(closePool);
test('spectral claim loss owns Linux SIGTERM through held close and preserves the replacement claim', { timeout: 40_000 }, async t => {
  const pool = getPool(); const store = createSourceUserSpectralJobStore(); const cache = createSourceUserSpectralCacheStore();
  const { job } = await store.enqueueSpectralJob({ username: 'fixture-peer', filePath: '/fixture', declaredCodec: 'flac', sampleRate: 44100 });
  const ready = Promise.withResolvers(); const terminating = Promise.withResolvers(); const closed = Promise.withResolvers(); let child; let retired = false; let evidence = 0;
  const command = createMediaCommandService({ allowedBinaries: [process.execPath], spawnFn: (_binary, _args, options) => {
    child = spawn(process.execPath, ['--input-type=module', '-e',
      "process.on('SIGTERM',()=>process.send('terminating'));process.on('message',()=>process.disconnect());process.send('ready');"],
    { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.on('message', message => { if (message === 'ready') ready.resolve(); if (message === 'terminating') terminating.resolve(); });
    child.once('close', () => { retired = true; closed.resolve(); }); return child;
  } });
  const analyzer = createFfmpegSpectralAnalyzer({ ffmpegBin: process.execPath, mediaCommandService: command });
  const service = createSourceUserSpectralSidecarService({ spectralJobStore: store, spectralCacheStore: cache,
    hashFileFn: async () => 'held-native-hash', analyzeSpectralCutoffFn: analyzer.analyzeSpectralCutoff,
    recordSourceUserOutcomeEvidenceFn: async () => { evidence++; } });
  const task = service.processPendingSpectralJobs();
  try {
    await waitForFixtureReady({ ready: ready.promise, operation: task, signal: t.signal });
    await pool.query("UPDATE source_user_spectral_jobs SET claimed_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [job.id]);
    assert.equal(await store.requeueStaleActiveJobs({ olderThanMs: 1 }), 1); const [replacement] = await store.claimNextSpectralJobs();
    await waitForFixtureReady({ ready: terminating.promise, operation: task, signal: t.signal });
    assert.equal(retired, false); assert.deepEqual(command.getAdmissionState(), { active: 1, queued: 0 });
    child.send('finish'); assert.equal((await task).interrupted, 1); await closed.promise;
    const row = (await pool.query('SELECT state, attempts FROM source_user_spectral_jobs WHERE id=$1', [job.id])).rows[0];
    assert.equal(row.state, 'active'); assert.equal(row.attempts, replacement.attempts); assert.equal(evidence, 0);
    assert.equal(await cache.getCachedMeasurement({ contentHash: 'held-native-hash' }), null);
    t.diagnostic(JSON.stringify({ scenario: 'spectral-held-close', closeAcknowledged: true, replacementUntouched: true, cacheWrites: 0, reputationWrites: 0 }));
  } finally { if (child?.connected) child.send('finish'); await Promise.allSettled([task, child ? closed.promise : undefined]); }
});

test('actual spectral FFmpeg measures then cancels after decoded metadata without source or cache publication', { timeout: 90_000 }, async t => {
  const result = await withDeploymentMediaFixture(async fixture => {
    const controller = new AbortController(); const records = []; let cancelling = false; let sawMetadata = false;
    const commands = createMediaCommandService({ spawnFn: (binary, args, options) => {
      const child = spawn(binary, args, options); const record = { closed: false }; records.push(record);
      child.once('close', () => { record.closed = true; });
      if (cancelling) {
        let metadata = ''; child.stdout.on('data', chunk => {
          metadata = (metadata + chunk.toString()).slice(-4096);
          if (!controller.signal.aborted && metadata.includes('lavfi.aspectralstats')) { sawMetadata = true; controller.abort(null); }
        });
      }
      return child;
    } });
    const normal = await createFfmpegSpectralAnalyzer({ mediaCommandService: commands, maxAnalysisSeconds: 1 }).analyzeSpectralCutoff({ filePath: fixture.longSource });
    assert.ok(normal.frameCount > 0); cancelling = true;
    const cache = createSourceUserSpectralCacheStore();
    const proof = createMediaSpectralProofService({ hashFileFn: createFileContentHasher().hashFile, spectralCacheStore: cache,
      analyzeSpectralCutoffFn: createFfmpegSpectralAnalyzer({ mediaCommandService: commands }).analyzeSpectralCutoff,
      onWarning: () => assert.fail('Cancellation is not a warning'),
    });
    await assert.rejects(proof.verifySpectralProof({ filePath: fixture.longSource, declaredCodec: 'flac', signal: controller.signal }), error => error === null);
    assert.equal(sawMetadata, true); assert.ok(records.every(row => row.closed));
    assert.deepEqual(commands.getAdmissionState(), { active: 0, queued: 0 });
    const contentHash = await createFileContentHasher().hashFile({ filePath: fixture.longSource });
    assert.equal(await cache.getCachedMeasurement({ contentHash }), null);
    return { normalFrames: normal.frameCount, nativeCommands: records.length, closedCommands: records.length };
  });
  assert.equal(result.mediaFixture.originalFilesUnchanged, true);
  // Scalar diagnostics avoid file paths, hashes and source identities.
  t.diagnostic(JSON.stringify({ scenario: 'spectral-actual-ffmpeg', nativeCommands: result.nativeCommands,
    closedCommands: result.closedCommands, measuredFrames: result.normalFrames, cancelledAfterMetadata: true,
    originalFilesUnchanged: true, cacheWrites: 0, ffmpegVersion: result.mediaFixture.ffmpegVersion }));
});
