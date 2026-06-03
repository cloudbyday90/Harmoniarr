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
import { createFileContentHasher } from '../../src/server/media/file-content-hasher.js';
import { buildContentFingerprint } from '../../src/server/media/media-content-fingerprint.js';

function createFakeFileHandle(bytes, { onClose } = {}) {
  return {
    async stat() {
      return { size: bytes.length };
    },
    async read(buffer, offset, length, position) {
      const slice = bytes.subarray(position, position + length);
      slice.copy(buffer, offset);
      return { bytesRead: slice.length };
    },
    async close() {
      if (onClose) {
        onClose();
      }
    },
  };
}

test('hashFile reads the full file when small and closes the handle', async () => {
  const bytes = Buffer.from('a-small-lossless-master');
  let closed = false;
  const hasher = createFileContentHasher({
    openFileFn: async () => createFakeFileHandle(bytes, { onClose: () => { closed = true; } }),
  });

  const digest = await hasher.hashFile({ filePath: '/x.flac' });
  const expected = buildContentFingerprint({ sizeBytes: bytes.length, chunks: [bytes] });

  assert.equal(digest, expected);
  assert.equal(closed, true);
});

test('hashFile samples head/middle/tail windows for large files', async () => {
  const size = 5 * 1024 * 1024;
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i += 1) {
    bytes[i] = i % 251;
  }
  const sampleSize = 16 * 1024;
  const hasher = createFileContentHasher({
    openFileFn: async () => createFakeFileHandle(bytes),
  });

  const digest = await hasher.hashFile({ filePath: '/big.flac', sizeBytes: size });

  const middle = Math.floor(size / 2);
  const expected = buildContentFingerprint({
    sizeBytes: size,
    chunks: [
      bytes.subarray(0, sampleSize),
      bytes.subarray(middle, middle + sampleSize),
      bytes.subarray(size - sampleSize, size),
    ],
  });
  assert.equal(digest, expected);
});

test('hashFile throws when filePath is missing', async () => {
  const hasher = createFileContentHasher({ openFileFn: async () => createFakeFileHandle(Buffer.from('x')) });
  await assert.rejects(() => hasher.hashFile({}), /filePath/);
});

test('hashFile closes the handle even when a read fails', async () => {
  let closed = false;
  const hasher = createFileContentHasher({
    openFileFn: async () => ({
      async stat() { return { size: 10 }; },
      async read() { throw new Error('read boom'); },
      async close() { closed = true; },
    }),
  });

  await assert.rejects(() => hasher.hashFile({ filePath: '/x.flac' }), /read boom/);
  assert.equal(closed, true);
});
