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
import {
  RETROACTIVE_SCAN_USERNAME,
  createSourceUserSpectralJobStore,
} from '../../src/server/activity/source-user-spectral-job-store.js';

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

test('enqueueRetroactiveLibraryJobs inserts retroactive jobs with the sentinel identity', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'job-1' }] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const result = await store.enqueueRetroactiveLibraryJobs({
    files: [
      { libraryFileId: 'lf-1', filePath: '/a.flac', declaredCodec: 'flac', declaredExtension: '.flac', sampleRate: 44100 },
    ],
  });

  assert.equal(result.enqueued, 1);
  assert.equal(result.skipped, 0);
  const { params, text } = pool.calls[0];
  assert.match(text, /'retroactive'/);
  assert.equal(params[1], RETROACTIVE_SCAN_USERNAME);
  assert.equal(params[7], 'lf-1');
});

test('enqueueRetroactiveLibraryJobs skips files missing a libraryFileId', async () => {
  const pool = createFakePool(() => ({ rows: [{ id: 'job' }] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const result = await store.enqueueRetroactiveLibraryJobs({
    files: [{ filePath: '/a.flac' }],
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.skipped, 1);
  assert.equal(pool.calls.length, 0);
});

test('enqueueRetroactiveLibraryJobs counts a backlog-capped insert as skipped', async () => {
  const pool = createFakePool(() => ({ rows: [] }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const result = await store.enqueueRetroactiveLibraryJobs({
    files: [{ libraryFileId: 'lf-1', filePath: '/a.flac' }],
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.skipped, 1);
});

test('listSharedTranscodeFingerprints maps grouped rows and clamps minDistinctUsers', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      content_hash: 'h1',
      distinct_users: 3,
      members: [
        { usernameKey: 'a', username: 'A' },
        { usernameKey: 'b', username: 'B' },
      ],
      estimated_source_bitrate: 192,
    }],
  }));
  const store = createSourceUserSpectralJobStore({ getPoolFn: pool.getPoolFn });

  const rows = await store.listSharedTranscodeFingerprints({ minDistinctUsers: 1, limit: 10 });

  assert.equal(pool.calls[0].params[0], 2);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contentHash, 'h1');
  assert.equal(rows[0].distinctUsers, 3);
  assert.equal(rows[0].members.length, 2);
  assert.equal(rows[0].estimatedSourceBitrate, 192);
  assert.match(pool.calls[0].text, /origin = 'apply'/);
  assert.match(pool.calls[0].text, /verdict = 'transcoded'/);
});
