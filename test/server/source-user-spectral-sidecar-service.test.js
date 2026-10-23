/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';

function createStoreStub({ enqueueResult, claimJobs = [] } = {}) {
  const calls = { complete: [], enqueue: [], fail: [] };
  return {
    calls,
    store: {
      claimNextSpectralJobs: async () => claimJobs.map(job => ({ ...job, attempts: 1 })),
      isSpectralJobClaimCurrent: async () => true,
      withSpectralJobClaim: async (_input, work) => work(null),
      releaseSpectralJobClaim: async () => true,
      completeSpectralJob: async (input) => { calls.complete.push(input); return { recorded: true }; },
      countPendingSpectralJobs: async () => 0,
      enqueueSpectralJob: async (input) => {
        calls.enqueue.push(input);
        return enqueueResult ?? { enqueued: true, job: { id: 'job' }, reason: null };
      },
      failSpectralJob: async (input) => { calls.fail.push(input); return { recorded: true }; },
      pruneSpectralJobs: async () => 0,
      requeueStaleActiveJobs: async () => 0,
    },
  };
}

test('enqueueForAppliedCandidate only queues lossless-claimed files and honours back-pressure', async () => {
  const stub = createStoreStub({ enqueueResult: { enqueued: false, job: null, reason: 'backlog_full' } });
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 20000, frameCount: 1 }),
  });

  const summary = await service.enqueueForAppliedCandidate({
    username: 'peer',
    importCandidateId: 'cand-1',
    files: [
      { filePath: '/a.flac', declaredCodec: 'flac', declaredExtension: 'flac', sampleRate: 44100 },
      { filePath: '/b.mp3', declaredCodec: 'mp3', declaredExtension: 'mp3', sampleRate: 44100 },
      { filePath: '/c.flac', declaredCodec: 'flac', declaredExtension: 'flac', sampleRate: 22050 },
    ],
  });

  assert.equal(stub.calls.enqueue.length, 1);
  assert.equal(summary.enqueued, 0);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.skipped, 2);
});

test('processPendingSpectralJobs merges a confirmed transcode into the reputation ledger', async () => {
  const stub = createStoreStub({
    claimJobs: [{
      id: 'job-1',
      username: 'FLAC-Peer',
      filePath: '/library/a.flac',
      declaredCodec: 'flac',
      declaredExtension: 'flac',
      sampleRate: 44100,
    }],
  });
  const evidenceCalls = [];
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 15500, frameCount: 120 }),
    recordSpectralOutcomeEvidenceFn: async (input) => { evidenceCalls.push(input); return { recorded: true }; },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.transcodedConfirmed, 1);
  assert.equal(evidenceCalls.length, 1);
  assert.equal(evidenceCalls[0].job.id, 'job-1');
  assert.ok(Object.hasOwn(evidenceCalls[0], 'queryable'));
  assert.equal(evidenceCalls[0].job.username, 'FLAC-Peer');
  assert.ok(evidenceCalls[0].qualityWeight <= 0.05 + 1e-9);
  assert.equal(stub.calls.complete.length, 1);
  assert.equal(stub.calls.complete[0].verdict, 'transcoded');
});

test('processPendingSpectralJobs does not penalize an authentic file', async () => {
  const stub = createStoreStub({
    claimJobs: [{ id: 'job-1', username: 'peer', filePath: '/a.flac', declaredCodec: 'flac', declaredExtension: 'flac', sampleRate: 44100 }],
  });
  const evidenceCalls = [];
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 21000, frameCount: 90 }),
    recordSpectralOutcomeEvidenceFn: async (input) => { evidenceCalls.push(input); return { recorded: true }; },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.authentic, 1);
  assert.equal(evidenceCalls.length, 0);
  assert.equal(stub.calls.complete[0].verdict, 'authentic');
});

test('processPendingSpectralJobs fails a job when analysis throws and never throws itself', async () => {
  const stub = createStoreStub({
    claimJobs: [{ id: 'job-1', username: 'peer', filePath: '/a.flac', declaredCodec: 'flac', declaredExtension: 'flac', sampleRate: 44100 }],
  });
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => { throw new Error('ffmpeg unavailable'); },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.failed, 1);
  assert.equal(stub.calls.fail.length, 1);
  assert.equal(stub.calls.fail[0].error, 'Spectral processing failed');
});
