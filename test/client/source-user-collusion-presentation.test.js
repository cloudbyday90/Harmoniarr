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
  buildCollusionViewModel,
  formatCollusionHeadline,
  formatEstimatedBitrate,
  formatFingerprintPreview,
  formatRingSummary,
} from '../../src/client/lib/source-user-collusion-presentation.js';

test('formatFingerprintPreview truncates long hashes and guards blanks', () => {
  assert.equal(formatFingerprintPreview('0123456789abcdef0123'), '0123456789ab…');
  assert.equal(formatFingerprintPreview('short'), 'short');
  assert.equal(formatFingerprintPreview('   '), '—');
  assert.equal(formatFingerprintPreview(null), '—');
});

test('formatEstimatedBitrate renders kbps or an em dash', () => {
  assert.equal(formatEstimatedBitrate(192.4), '~192 kbps');
  assert.equal(formatEstimatedBitrate(0), '—');
  assert.equal(formatEstimatedBitrate(null), '—');
});

test('formatRingSummary pluralizes peers and fingerprints', () => {
  assert.equal(formatRingSummary({ memberCount: 1, sharedFingerprintCount: 1 }), '1 peer · 1 shared fingerprint');
  assert.equal(formatRingSummary({ memberCount: 3, sharedFingerprintCount: 2 }), '3 peers · 2 shared fingerprints');
});

test('formatCollusionHeadline summarizes the report', () => {
  assert.equal(formatCollusionHeadline({ ringCount: 0 }), 'No shared fake fingerprints detected across peers.');
  assert.equal(formatCollusionHeadline({ ringCount: 2, implicatedUserCount: 5 }), '2 rings implicating 5 peers.');
});

test('buildCollusionViewModel always returns an array of rings', () => {
  const vm = buildCollusionViewModel(null);
  assert.deepEqual(vm.rings, []);
  assert.equal(vm.ringCount, 0);

  const populated = buildCollusionViewModel({
    rings: [{ ringId: 'ring-1' }],
    ringCount: 1,
    implicatedUserCount: 2,
    analyzedFingerprintCount: 4,
  });
  assert.equal(populated.rings.length, 1);
  assert.equal(populated.implicatedUserCount, 2);
  assert.equal(populated.analyzedFingerprintCount, 4);
});
