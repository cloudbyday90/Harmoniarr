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

function createStoreStub(claimJobs = []) {
  const calls = { complete: [], fail: [] };
  return {
    calls,
    store: {
      claimNextSpectralJobs: async () => claimJobs,
      completeSpectralJob: async (input) => { calls.complete.push(input); return input; },
      countPendingSpectralJobs: async () => 0,
      enqueueSpectralJob: async () => ({ enqueued: true, job: { id: 'job' }, reason: null }),
      failSpectralJob: async (input) => { calls.fail.push(input); return input; },
      pruneSpectralJobs: async () => 0,
      requeueStaleActiveJobs: async () => 0,
    },
  };
}

test('a cache hit reuses the measurement and skips the analyzer', async () => {
  const stub = createStoreStub([{
    id: 'job-1',
    username: 'peer',
    filePath: '/a.flac',
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    sampleRate: 44100,
    origin: 'apply',
  }]);
  let analyzerCalls = 0;
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => { analyzerCalls += 1; return { cutoffHz: 20000, frameCount: 5 }; },
    hashFileFn: async () => 'cafe',
    spectralCacheStore: {
      getCachedMeasurement: async () => ({ cutoffHz: 18000, frameCount: 99 }),
      putCachedMeasurement: async () => null,
    },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.cacheHits, 1);
  assert.equal(analyzerCalls, 0);
  assert.equal(stub.calls.complete[0].contentHash, 'cafe');
  assert.equal(stub.calls.complete[0].analysis.servedFromCache, true);
});

test('a cache miss runs the analyzer and writes back to the cache', async () => {
  const stub = createStoreStub([{
    id: 'job-1',
    username: 'peer',
    filePath: '/a.flac',
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    sampleRate: 44100,
    origin: 'apply',
  }]);
  const puts = [];
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 20000, frameCount: 5 }),
    hashFileFn: async () => 'beef',
    spectralCacheStore: {
      getCachedMeasurement: async () => null,
      putCachedMeasurement: async (input) => { puts.push(input); return input; },
    },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.cacheHits, 0);
  assert.equal(summary.analyzed, 1);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].contentHash, 'beef');
});

test('retroactive jobs never write peer reputation even when penalized', async () => {
  const stub = createStoreStub([{
    id: 'job-1',
    username: '__retroactive_library_scan__',
    filePath: '/library/a.flac',
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    sampleRate: 44100,
    origin: 'retroactive',
  }]);
  const evidenceCalls = [];
  const service = createSourceUserSpectralSidecarService({
    spectralJobStore: stub.store,
    // A cutoff this low on a lossless claim is a confirmed transcode (penalize=true).
    analyzeSpectralCutoffFn: async () => ({ cutoffHz: 15500, frameCount: 120 }),
    recordSourceUserOutcomeEvidenceFn: async (input) => { evidenceCalls.push(input); return input; },
  });

  const summary = await service.processPendingSpectralJobs({ limit: 4 });

  assert.equal(summary.transcodedConfirmed, 1);
  assert.equal(evidenceCalls.length, 0);
});
