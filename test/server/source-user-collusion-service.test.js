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
import { createSourceUserCollusionService } from '../../src/server/activity/source-user-collusion-service.js';

test('getCollusionReport runs the detector over fetched fingerprints', async () => {
  const service = createSourceUserCollusionService({
    listSharedTranscodeFingerprintsFn: async () => ([
      { contentHash: 'h1', members: [{ usernameKey: 'a' }, { usernameKey: 'b' }] },
    ]),
  });

  const report = await service.getCollusionReport({});

  assert.equal(report.ringCount, 1);
  assert.equal(report.minDistinctUsers, 2);
  assert.equal(typeof report.checkedAt, 'string');
});

test('getCollusionReport is fail-safe and returns an empty report on query error', async () => {
  const warnings = [];
  const service = createSourceUserCollusionService({
    listSharedTranscodeFingerprintsFn: async () => { throw new Error('db down'); },
    onWarning: (message) => warnings.push(message),
  });

  const report = await service.getCollusionReport({});
  assert.equal(report.ringCount, 0);
  assert.equal(warnings.length, 1);
});

test('getCollusionReport clamps minDistinctUsers to at least 2', async () => {
  const calls = [];
  const service = createSourceUserCollusionService({
    listSharedTranscodeFingerprintsFn: async (input) => { calls.push(input); return []; },
  });
  await service.getCollusionReport({ minDistinctUsers: 1 });
  assert.equal(calls[0].minDistinctUsers, 2);
});
