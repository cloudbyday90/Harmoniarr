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
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ params, text });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('enqueueSpectralJob inserts a normalized job guarded by the backlog cap', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      id: 'job-1',
      username_key: 'flac-peer',
      username: 'FLAC-Peer',
      file_path: '/library/a.flac',
      state: 'pending',
      attempts: 0,
    }],
  }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn, maxBacklog: 250 });

  const result = await store.enqueueSpectralJob({
    username: '  FLAC-Peer ',
    filePath: '/library/a.flac',
    declaredCodec: 'flac',
    declaredExtension: 'flac',
    sampleRate: 44100,
    bitRate: 900000,
  });

  assert.equal(result.enqueued, true);
  assert.equal(result.job.id, 'job-1');
  assert.match(pool.calls[0].text, /INSERT INTO source_user_spectral_jobs/);
  assert.match(pool.calls[0].text, /WHERE \(\s*SELECT COUNT/i);
  assert.equal(pool.calls[0].params[0], 'flac-peer');
  assert.equal(pool.calls[0].params[1], 'FLAC-Peer');
  assert.equal(pool.calls[0].params[8], 250);
});

test('enqueueSpectralJob reports back-pressure when the insert returns no row', async () => {
  const pool = createFakePool(() => ({ rows: [] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const result = await store.enqueueSpectralJob({ username: 'peer', filePath: '/x.flac' });

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, 'backlog_full');
  assert.equal(result.job, null);
});

test('enqueueSpectralJob rejects blank username and filePath', async () => {
  const pool = createFakePool();
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  await assert.rejects(() => store.enqueueSpectralJob({ username: '   ', filePath: '/x.flac' }), /username/);
  await assert.rejects(() => store.enqueueSpectralJob({ username: 'peer', filePath: '  ' }), /filePath/);
});

test('claimNextSpectralJobs claims pending work with SKIP LOCKED and a clamped limit', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'job-1', username: 'peer', username_key: 'peer', file_path: '/a.flac', state: 'active', attempts: 1 }] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const jobs = await store.claimNextSpectralJobs({ limit: 999 });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].state, 'active');
  assert.match(pool.calls[0].text, /FOR UPDATE SKIP LOCKED/);
  assert.match(pool.calls[0].text, /state = 'active'/);
  assert.equal(pool.calls[0].params[0], 50);
});

test('completeSpectralJob persists the verdict and serializes the analysis blob', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'job-1', username: 'peer', username_key: 'peer', file_path: '/a.flac', state: 'done', attempts: 1, verdict: 'transcoded' }] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const job = await store.completeSpectralJob({
    id: 'job-1',
    verdict: 'transcoded',
    cutoffHz: 15800,
    estimatedSourceBitrate: 128,
    analysis: { confidence: 0.9 },
  });

  assert.equal(job.verdict, 'transcoded');
  assert.match(pool.calls[0].text, /state = 'done'/);
  assert.equal(pool.calls[0].params[1], 'transcoded');
  assert.equal(pool.calls[0].params[2], 15800);
  assert.equal(pool.calls[0].params[4], JSON.stringify({ confidence: 0.9 }));
});

test('failSpectralJob requeues to pending until the attempt cap is reached', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'job-1', username: 'peer', username_key: 'peer', file_path: '/a.flac', state: 'pending', attempts: 1 }] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  await store.failSpectralJob({ id: 'job-1', error: 'ffmpeg blew up', maxAttempts: 3 });

  assert.match(pool.calls[0].text, /CASE WHEN attempts >= \$3 THEN 'failed' ELSE 'pending' END/);
  assert.equal(pool.calls[0].params[1], 'ffmpeg blew up');
  assert.equal(pool.calls[0].params[2], 3);
});

test('requeueStaleActiveJobs and countPendingSpectralJobs return counts', async () => {
  const pool = createFakePool((text) => {
    if (/UPDATE source_user_spectral_jobs/.test(text)) {
      return { rows: [{ id: 'job-1' }], rowCount: 1 };
    }
    return { rows: [{ pending: 4 }] };
  });
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  assert.equal(await store.requeueStaleActiveJobs({ olderThanMs: 1000 }), 1);
  assert.equal(await store.countPendingSpectralJobs(), 4);
});
