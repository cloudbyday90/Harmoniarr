/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { before, after, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';
import { createSourceUserSpectralCacheStore } from '../../src/server/activity/source-user-spectral-cache-store.js';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';
import { createMediaSpectralProofService } from '../../src/server/media/media-spectral-proof-service.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createFfmpegSpectralAnalyzer } from '../../src/server/media/ffmpeg-spectral-analyzer.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
async function fixture(work) {
  return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseConfig }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn();
    const store = createSourceUserSpectralJobStore({ getPoolFn }); const cache = createSourceUserSpectralCacheStore({ getPoolFn });
    const { job } = await store.enqueueSpectralJob({ username: 'fixture-peer', filePath: '/fixture/source.flac', declaredCodec: 'flac', sampleRate: 44100 });
    const read = async () => (await pool.query('SELECT * FROM source_user_spectral_jobs WHERE id=$1', [job.id])).rows[0];
    const countCache = async () => Number((await pool.query('SELECT COUNT(*) AS count FROM source_user_spectral_cache')).rows[0].count);
    const service = overrides => createSourceUserSpectralSidecarService({ spectralJobStore: store, spectralCacheStore: cache,
      hashFileFn: async () => 'fixture-hash', analyzeSpectralCutoffFn: async () => ({ cutoffHz: 15500, frameCount: 120 }), ...overrides });
    await work({ pool, getPoolFn, databaseConfig, store, cache, job, read, countCache, service });
  });
}
async function expire(c) {
  await c.pool.query("UPDATE source_user_spectral_jobs SET claimed_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [c.job.id]);
}

suite('spectral interruption and claim publication in real PostgreSQL', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('owned cache and job commit before returned reputation evidence', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
    let evidence = 0;
    const result = await c.service({ recordSourceUserOutcomeEvidenceFn: async () => {
      assert.equal((await c.read()).state, 'done'); assert.equal(await c.countCache(), 1); evidence++;
    } }).processPendingSpectralJobs();
    assert.equal(result.transcodedConfirmed, 1); assert.equal(evidence, 1); assert.equal((await c.read()).attempts, 1);
  }));

  test('old claim cannot complete, fail, release or enter publication after requeue/reclaim', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
    const [first] = await c.store.claimNextSpectralJobs(); await expire(c); assert.equal(await c.store.requeueStaleActiveJobs({ olderThanMs: 1 }), 1);
    const [second] = await c.store.claimNextSpectralJobs(); assert.equal(second.attempts, first.attempts + 1);
    assert.equal(await c.store.completeSpectralJob({ id: first.id, expectedClaim: first }), null);
    assert.equal(await c.store.failSpectralJob({ id: first.id, expectedClaim: first }), null);
    assert.equal(await c.store.releaseSpectralJobClaim({ expectedClaim: first }), false);
    await assert.rejects(c.store.withSpectralJobClaim({ expectedClaim: first }, () => assert.fail('No stale publication')), { code: 'spectral_job_claim_lost' });
    assert.equal((await c.read()).attempts, second.attempts); assert.equal((await c.read()).state, 'active'); assert.equal(await c.countCache(), 0);
  }));

  test('claim loss interrupts an actual native child before any stale cache/job/evidence write', { timeout: config.scenarioTimeoutMs }, async t => fixture(async c => {
    const ready = Promise.withResolvers(); const closed = Promise.withResolvers(); let child; let retired = false; let evidence = 0;
    const commands = createMediaCommandService({ allowedBinaries: [process.execPath], spawnFn: (_binary, _args, options) => {
      child = spawn(process.execPath, ['--input-type=module', '-e', "process.on('message',()=>process.disconnect());process.send('ready');"],
        { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      child.once('message', () => ready.resolve()); child.once('close', () => { retired = true; closed.resolve(); }); return child;
    } });
    const analyzer = createFfmpegSpectralAnalyzer({ ffmpegBin: process.execPath, mediaCommandService: commands });
    const task = c.service({ analyzeSpectralCutoffFn: analyzer.analyzeSpectralCutoff, recordSourceUserOutcomeEvidenceFn: async () => { evidence++; } }).processPendingSpectralJobs();
    try {
      await waitForFixtureReady({ ready: ready.promise, operation: task, signal: t.signal }); await expire(c);
      assert.equal(await c.store.requeueStaleActiveJobs({ olderThanMs: 1 }), 1); const [replacement] = await c.store.claimNextSpectralJobs();
      assert.equal((await task).interrupted, 1); assert.equal(retired, true); assert.equal(evidence, 0); assert.equal(await c.countCache(), 0);
      assert.equal((await c.read()).attempts, replacement.attempts); assert.equal((await c.read()).state, 'active');
      assert.deepEqual(commands.getAdmissionState(), { active: 0, queued: 0 });
    } finally { if (child && !retired) child.kill(); await Promise.allSettled([task, child ? closed.promise : undefined]); }
  }));

  test('abort during held cache/job publication rolls back cache and releases only the captured active claim', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const controller = new AbortController(); let evidence = 0;
    const service = c.service({ spectralCacheStore: { ...c.cache, putCachedMeasurement: async input => {
      const result = await c.cache.putCachedMeasurement(input); entered.resolve(); await gate.promise; return result;
    } }, recordSourceUserOutcomeEvidenceFn: async () => { evidence++; } });
    const task = service.processPendingSpectralJobs({ signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
    await entered.promise; assert.equal(await c.countCache(), 0); controller.abort(null); gate.resolve(); await refused;
    assert.equal(await c.countCache(), 0); assert.equal((await c.read()).state, 'pending'); assert.equal(evidence, 0);
  }));

  test('pre-add proof cancellation rolls back an admitted real cache INSERT', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const controller = new AbortController();
    const cache = createSourceUserSpectralCacheStore({ getPoolFn: () => ({ connect: async () => {
      const client = await c.pool.connect(); return { release: error => client.release(error), query: async (...args) => {
        const result = await client.query(...args); if (/INSERT INTO source_user_spectral_cache/u.test(args[0])) { entered.resolve(); await gate.promise; } return result;
      } };
    } }), });
    const proof = createMediaSpectralProofService({ hashFileFn: async () => 'proof-hash', spectralCacheStore: { ...cache, getCachedMeasurement: async () => null },
      analyzeSpectralCutoffFn: async () => ({ cutoffHz: 20000, frameCount: 120 }) });
    const task = proof.verifySpectralProof({ filePath: '/fixture', declaredCodec: 'flac', signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
    await entered.promise; assert.equal(await c.countCache(), 0); controller.abort(null); gate.resolve(); await refused; assert.equal(await c.countCache(), 0);
  }));

  test('requeue waits for a publication lock and cannot reclaim the completed generation', { timeout: config.scenarioTimeoutMs }, async t => fixture(async c => {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let requeue;
    const task = c.service({ spectralCacheStore: { ...c.cache, putCachedMeasurement: async input => {
      const result = await c.cache.putCachedMeasurement(input); entered.resolve(); await gate.promise; return result;
    } } }).processPendingSpectralJobs();
    try {
      await entered.promise;
      // The row's claimed_at is already older than this threshold by the time publication begins.
      requeue = c.store.requeueStaleActiveJobs({ olderThanMs: 1 });
      await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal: t.signal }, async observer => {
        for (let n = 0; n < 100; n++) {
          const result = await observer.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0 AND query LIKE '%claimed_at < NOW()%'");
          if (result.rows.length) return;
          await new Promise(resolve => { setTimeout(resolve, 10); });
        }
        assert.fail('Expected actual recovery lock wait');
      });
      gate.resolve(); assert.equal((await task).analyzed, 1); assert.equal(await requeue, 0); assert.equal((await c.read()).state, 'done');
    } finally { gate.resolve(); await Promise.allSettled([task, requeue]); }
  }));
});
