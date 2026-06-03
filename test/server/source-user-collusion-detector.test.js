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
import { detectCollusionRings } from '../../src/server/activity/source-user-collusion-detector.js';

test('returns no rings when no fingerprint is shared by two peers', () => {
  const report = detectCollusionRings({
    sharedFingerprints: [
      { contentHash: 'h1', members: [{ usernameKey: 'a', username: 'A' }] },
    ],
  });
  assert.equal(report.ringCount, 0);
  assert.equal(report.implicatedUserCount, 0);
  assert.equal(report.analyzedFingerprintCount, 0);
});

test('groups two peers sharing one fingerprint into a ring', () => {
  const report = detectCollusionRings({
    sharedFingerprints: [
      { contentHash: 'h1', members: [{ usernameKey: 'a', username: 'A' }, { usernameKey: 'b', username: 'B' }], estimatedSourceBitrate: 192 },
    ],
  });
  assert.equal(report.ringCount, 1);
  assert.equal(report.implicatedUserCount, 2);
  assert.equal(report.rings[0].ringId, 'ring-1');
  assert.equal(report.rings[0].memberCount, 2);
  assert.deepEqual(report.rings[0].members.map((m) => m.usernameKey), ['a', 'b']);
  assert.equal(report.rings[0].fingerprints[0].estimatedSourceBitrate, 192);
});

test('transitively merges peers connected through different fingerprints', () => {
  // a~b via h1, b~c via h2 => single ring {a,b,c}.
  const report = detectCollusionRings({
    sharedFingerprints: [
      { contentHash: 'h1', members: [{ usernameKey: 'a' }, { usernameKey: 'b' }] },
      { contentHash: 'h2', members: [{ usernameKey: 'b' }, { usernameKey: 'c' }] },
    ],
  });
  assert.equal(report.ringCount, 1);
  assert.deepEqual(report.rings[0].members.map((m) => m.usernameKey), ['a', 'b', 'c']);
  assert.equal(report.rings[0].sharedFingerprintCount, 2);
});

test('keeps unrelated rings separate and orders by shared fingerprint count', () => {
  const report = detectCollusionRings({
    sharedFingerprints: [
      { contentHash: 'p', members: [{ usernameKey: 'x' }, { usernameKey: 'y' }] },
      { contentHash: 'q1', members: [{ usernameKey: 'm' }, { usernameKey: 'n' }] },
      { contentHash: 'q2', members: [{ usernameKey: 'm' }, { usernameKey: 'n' }] },
    ],
  });
  assert.equal(report.ringCount, 2);
  // The ring with 2 shared fingerprints ranks first.
  assert.equal(report.rings[0].sharedFingerprintCount, 2);
  assert.deepEqual(report.rings[0].members.map((m) => m.usernameKey), ['m', 'n']);
});

test('is deterministic regardless of input order', () => {
  const input = [
    { contentHash: 'h2', members: [{ usernameKey: 'c' }, { usernameKey: 'b' }] },
    { contentHash: 'h1', members: [{ usernameKey: 'b' }, { usernameKey: 'a' }] },
  ];
  const a = detectCollusionRings({ sharedFingerprints: input });
  const b = detectCollusionRings({ sharedFingerprints: [...input].reverse() });
  assert.deepEqual(a.rings, b.rings);
});
