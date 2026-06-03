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
  DEFAULT_SAMPLE_SIZE,
  buildContentFingerprint,
  resolveFingerprintPlan,
} from '../../src/server/media/media-content-fingerprint.js';

test('resolveFingerprintPlan hashes small files in full', () => {
  const plan = resolveFingerprintPlan({ sizeBytes: 1000 });
  assert.equal(plan.mode, 'full');
  assert.deepEqual(plan.windows, [{ position: 0, length: 1000 }]);
});

test('resolveFingerprintPlan hashes in full when size is below 4x the window', () => {
  // With a small custom threshold the binding constraint becomes the 4x-window
  // rule: 40 KiB is above the 10 KiB threshold but below 4 * 16 KiB.
  const plan = resolveFingerprintPlan({ sizeBytes: 40 * 1024, sampleThreshold: 10 * 1024 });
  assert.equal(plan.mode, 'full');
});

test('resolveFingerprintPlan samples head, middle and tail for large files', () => {
  const sizeBytes = 10 * 1024 * 1024;
  const plan = resolveFingerprintPlan({ sizeBytes });
  assert.equal(plan.mode, 'sampled');
  assert.equal(plan.sampleSize, DEFAULT_SAMPLE_SIZE);
  assert.equal(plan.windows.length, 3);
  assert.deepEqual(plan.windows[0], { position: 0, length: DEFAULT_SAMPLE_SIZE });
  assert.equal(plan.windows[1].position, Math.floor(sizeBytes / 2));
  assert.equal(plan.windows[2].position, sizeBytes - DEFAULT_SAMPLE_SIZE);
});

test('buildContentFingerprint is deterministic for identical inputs', () => {
  const chunks = [Buffer.from('head'), Buffer.from('middle'), Buffer.from('tail')];
  const a = buildContentFingerprint({ sizeBytes: 4096, chunks });
  const b = buildContentFingerprint({ sizeBytes: 4096, chunks: chunks.map((c) => Buffer.from(c)) });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('buildContentFingerprint is sensitive to file size even with identical bytes', () => {
  const chunks = [Buffer.from('same-bytes')];
  const a = buildContentFingerprint({ sizeBytes: 100, chunks });
  const b = buildContentFingerprint({ sizeBytes: 200, chunks });
  assert.notEqual(a, b);
});

test('buildContentFingerprint is sensitive to window content', () => {
  const a = buildContentFingerprint({ sizeBytes: 100, chunks: [Buffer.from('aaaa')] });
  const b = buildContentFingerprint({ sizeBytes: 100, chunks: [Buffer.from('bbbb')] });
  assert.notEqual(a, b);
});
