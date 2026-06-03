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
import { createLibrarySpectralScanSource } from '../../src/server/library/library-spectral-scan-source.js';

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

test('listLosslessLibraryFiles maps catalog rows to enqueue input', async () => {
  const pool = createFakePool(() => ({
    rows: [{
      id: 'lf-1',
      canonical_path: '/music/a.flac',
      extension: '.flac',
      audio_codec: 'flac',
      sample_rate_hz: 44100,
    }],
    rowCount: 1,
  }));
  const source = createLibrarySpectralScanSource({ getPoolFn: pool.getPoolFn });

  const files = await source.listLosslessLibraryFiles({ limit: 100 });

  assert.equal(files.length, 1);
  assert.deepEqual(files[0], {
    libraryFileId: 'lf-1',
    filePath: '/music/a.flac',
    declaredCodec: 'flac',
    declaredExtension: '.flac',
    sampleRate: 44100,
  });
});

test('listLosslessLibraryFiles caps the limit and excludes queued/deleted rows in SQL', async () => {
  const pool = createFakePool(() => ({ rows: [], rowCount: 0 }));
  const source = createLibrarySpectralScanSource({ getPoolFn: pool.getPoolFn });

  await source.listLosslessLibraryFiles({ limit: 99999 });

  const { params, text } = pool.calls[0];
  assert.equal(params[2], 2000);
  assert.match(text, /file_state = 'observed'/);
  assert.match(text, /NOT EXISTS/);
  assert.match(text, /deleted_at IS NULL/);
});
