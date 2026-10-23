import assert from 'node:assert/strict';
import test from 'node:test';
import { createFileContentHasher } from '../../src/server/media/file-content-hasher.js';
import { createMediaSpectralProofService } from '../../src/server/media/media-spectral-proof-service.js';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const input = { declaredCodec: 'flac', filePath: '/fixture/source.flac' };
for (const reason of [new Error('cancelled'), null]) {
  test(`sampled hash drains admitted read and close with original ${reason === null ? 'null' : 'Error'}`, async () => {
    const controller = new AbortController(); const reading = Promise.withResolvers(); const finishRead = Promise.withResolvers();
    const closing = Promise.withResolvers(); const finishClose = Promise.withResolvers(); let settled = false;
    const hasher = createFileContentHasher({ openFileFn: async () => ({
      read: async () => { reading.resolve(); await finishRead.promise; return { bytesRead: 0 }; },
      close: async () => { closing.resolve(); await finishClose.promise; throw new Error('later close error'); },
    }) });
    const task = hasher.hashFile({ ...input, sizeBytes: 10, signal: controller.signal });
    const refused = assert.rejects(task, error => error === reason); void task.then(() => { settled = true; }, () => { settled = true; });
    await reading.promise; controller.abort(reason); await flush(); assert.equal(settled, false);
    finishRead.resolve(); await closing.promise; assert.equal(settled, false); finishClose.resolve(); await refused;
  });
}

for (const phase of ['hash', 'cache', 'analysis']) {
  test(`pre-add proof refuses cancellation during ${phase} without warning or cache publication`, async () => {
    const controller = new AbortController(); const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let writes = 0;
    const hold = async value => { entered.resolve(); await gate.promise; return value; };
    const proof = createMediaSpectralProofService({ onWarning: () => assert.fail('Cancellation is not a warning'),
      hashFileFn: async ({ signal }) => { assert.equal(signal, controller.signal); return phase === 'hash' ? hold('hash') : 'hash'; },
      spectralCacheStore: { getCachedMeasurement: async () => phase === 'cache' ? hold({ cutoffHz: 20000 }) : null,
        putCachedMeasurement: async () => { writes++; } },
      analyzeSpectralCutoffFn: async ({ signal }) => { assert.equal(signal, controller.signal); return hold({ cutoffHz: 20000 }); },
    });
    const task = proof.verifySpectralProof({ ...input, signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
    await entered.promise; controller.abort(null); gate.resolve(); await refused; assert.equal(writes, 0);
  });
}

test('pre-aborted hash/proof dispatch nothing and abort during close refuses a fingerprint', async () => {
  const aborted = AbortSignal.abort(null);
  await assert.rejects(createFileContentHasher({ openFileFn: () => assert.fail('No open') }).hashFile({ ...input, signal: aborted }), error => error === null);
  await assert.rejects(createMediaSpectralProofService().verifySpectralProof({ signal: aborted }), error => error === null);
  const controller = new AbortController();
  const hasher = createFileContentHasher({ openFileFn: async () => ({ read: async () => ({ bytesRead: 0 }), close: async () => { controller.abort(null); } }) });
  await assert.rejects(hasher.hashFile({ ...input, sizeBytes: 1, signal: controller.signal }), error => error === null);
});

test('abort after claiming drains thresholds and all captured releases, preserving null over cleanup failure', async () => {
  const controller = new AbortController(); const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const released = [];
  const service = createSourceUserSpectralSidecarService({ analyzeSpectralCutoffFn: () => assert.fail('No dispatch'),
    loadSpectralThresholdsFn: async () => { entered.resolve(); await gate.promise; },
    spectralJobStore: { enqueueSpectralJob() {}, claimNextSpectralJobs: async () => [1, 2].map(n => ({ id: String(n), attempts: n })),
      releaseSpectralJobClaim: async ({ expectedClaim }) => { released.push(expectedClaim); if (expectedClaim.id === '1') throw new Error('cleanup'); } },
  });
  const task = service.processPendingSpectralJobs({ signal: controller.signal }); const refused = assert.rejects(task, error => error === null);
  await entered.promise; controller.abort(null); await flush(); assert.equal(released.length, 0);
  gate.resolve(); await refused; assert.deepEqual(released.map(row => row.id).sort(), ['1', '2']);
});

test('refused publication cannot cache or penalize, and successful publication precedes returned reputation', async () => {
  const calls = []; const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let refused = true;
  const job = { id: 'job', attempts: 1, username: 'fixture', sampleRate: 44100, declaredCodec: 'flac', contentHash: 'hash', filePath: '/fixture' };
  const service = createSourceUserSpectralSidecarService({ spectralJobStore: {
    enqueueSpectralJob() {}, claimNextSpectralJobs: async () => [job], isSpectralJobClaimCurrent: async () => true,
    withSpectralJobClaim: async (_input, work) => { if (refused) throw Object.assign(new Error('lost'), { code: 'spectral_job_claim_lost' }); return work(null); },
    completeSpectralJob: async () => { calls.push('complete'); return job; }, releaseSpectralJobClaim: async () => { calls.push('release'); },
  }, spectralCacheStore: { putCachedMeasurement: async () => { calls.push('cache'); } },
  analyzeSpectralCutoffFn: async () => ({ cutoffHz: 15500, frameCount: 120 }),
  recordSpectralOutcomeEvidenceFn: async () => ({ recorded: true, afterCommit: async () => { calls.push('evidence'); entered.resolve(); await gate.promise; } }),
  });
  assert.equal((await service.processPendingSpectralJobs()).interrupted, 1); assert.deepEqual(calls, ['release']);
  refused = false; calls.length = 0; const task = service.processPendingSpectralJobs(); await entered.promise;
  assert.deepEqual(calls, ['cache', 'complete', 'evidence']); gate.resolve(); assert.equal((await task).transcodedConfirmed, 1);
  assert.equal(calls.at(-1), 'release');
});
