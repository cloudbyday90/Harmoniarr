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
  minimumMusicBrainzRequestIntervalMs,
  musicBrainzRequestDefaults,
  resolveMusicBrainzRequestPolicy,
} from '../../src/server/integrations/musicbrainz/musicbrainz-request-policy.js';

test('MusicBrainz request policy preserves provider-safe defaults', () => {
  const policy = resolveMusicBrainzRequestPolicy({
    maxRetries: null,
    minIntervalMs: null,
    requestTimeoutMs: null,
  });

  assert.deepEqual(policy, musicBrainzRequestDefaults);
  assert.equal(Object.isFrozen(policy), true);
});

test('MusicBrainz request policy enforces the one-second request interval floor', () => {
  const policy = resolveMusicBrainzRequestPolicy({
    maxRetries: 0,
    minIntervalMs: 1,
    requestTimeoutMs: 5_000,
  });

  assert.equal(policy.minIntervalMs, minimumMusicBrainzRequestIntervalMs);
  assert.equal(policy.maxRetries, 0);
  assert.equal(policy.requestTimeoutMs, 5_000);
});

test('MusicBrainz request policy rejects malformed timeout and retry configuration', () => {
  assert.throws(
    () => resolveMusicBrainzRequestPolicy({ requestTimeoutMs: 'not-a-number' }),
    /Expected a positive integer but received not-a-number/,
  );
  assert.throws(
    () => resolveMusicBrainzRequestPolicy({ maxRetries: -1 }),
    /Expected a non-negative integer but received -1/,
  );
});
