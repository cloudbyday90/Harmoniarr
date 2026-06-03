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
import { createSourceUserSpectralRetroactiveScanService } from '../../src/server/activity/source-user-spectral-retroactive-service.js';

test('scanLibrary enqueues listed files and returns counts', async () => {
  const enqueueCalls = [];
  const service = createSourceUserSpectralRetroactiveScanService({
    listLosslessLibraryFilesFn: async () => ([
      { libraryFileId: 'f1', filePath: '/a.flac' },
      { libraryFileId: 'f2', filePath: '/b.flac' },
    ]),
    enqueueRetroactiveLibraryJobsFn: async (input) => {
      enqueueCalls.push(input);
      return { enqueued: 2, skipped: 0 };
    },
  });

  const result = await service.scanLibrary({ limit: 50 });

  assert.equal(result.candidates, 2);
  assert.equal(result.enqueued, 2);
  assert.equal(result.skipped, 0);
  assert.equal(enqueueCalls[0].files.length, 2);
});

test('scanLibrary returns zeros when no files match', async () => {
  const service = createSourceUserSpectralRetroactiveScanService({
    listLosslessLibraryFilesFn: async () => [],
    enqueueRetroactiveLibraryJobsFn: async () => ({ enqueued: 0, skipped: 0 }),
  });
  const result = await service.scanLibrary({});
  assert.deepEqual(result, { candidates: 0, enqueued: 0, skipped: 0 });
});

test('scanLibrary is fail-safe when listing throws', async () => {
  const warnings = [];
  const service = createSourceUserSpectralRetroactiveScanService({
    listLosslessLibraryFilesFn: async () => { throw new Error('db down'); },
    enqueueRetroactiveLibraryJobsFn: async () => ({ enqueued: 0, skipped: 0 }),
    onWarning: (message) => warnings.push(message),
  });
  const result = await service.scanLibrary({});
  assert.deepEqual(result, { candidates: 0, enqueued: 0, skipped: 0 });
  assert.equal(warnings.length, 1);
});

test('throws when required dependencies are missing', () => {
  assert.throws(() => createSourceUserSpectralRetroactiveScanService({}), /listLosslessLibraryFilesFn/);
});
