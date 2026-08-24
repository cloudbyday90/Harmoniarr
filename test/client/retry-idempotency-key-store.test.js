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
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

test('retry idempotency key store reuses an unconfirmed action key and replaces it after confirmation', () => {
  let keyCount = 0;
  const store = createRetryIdempotencyKeyStore({
    createIdempotencyKey(scope) {
      keyCount += 1;
      return `${scope}-${keyCount}`;
    },
  });

  assert.equal(store.getOrCreate({ actionKey: 'wanted-1:match-1:use', scope: 'acquisition.musicQueue.matches.use' }), 'acquisition.musicQueue.matches.use-1');
  assert.equal(store.getOrCreate({ actionKey: 'wanted-1:match-1:use', scope: 'different.scope.is.ignored.after.first.key' }), 'acquisition.musicQueue.matches.use-1');
  assert.equal(store.clear('wanted-1:match-1:use'), true);
  assert.equal(store.clear('wanted-1:match-1:use'), false);
  assert.equal(store.getOrCreate({ actionKey: 'wanted-1:match-1:use', scope: 'acquisition.musicQueue.matches.use' }), 'acquisition.musicQueue.matches.use-2');
});

test('retry idempotency key store rejects blank action and scope values', () => {
  const store = createRetryIdempotencyKeyStore();

  assert.throws(() => store.getOrCreate({ actionKey: ' ', scope: 'scope' }), /actionKey is required/);
  assert.throws(() => store.getOrCreate({ actionKey: 'action', scope: ' ' }), /scope is required/);
  assert.throws(() => store.clear(' '), /actionKey is required/);
});
