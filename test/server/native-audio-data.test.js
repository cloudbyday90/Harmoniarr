/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */


import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { nativeAudioFiles, nativeAudioChunk, nativeAudioDigest } from '../../testing/slskd/native-audio-data.js';

test('declared stereo PCM header and unaligned ranges preserve complete native audio bytes', () => {
  const file = nativeAudioFiles[0];
  const header = nativeAudioChunk(file, 0, 44);
  assert.equal(header.toString('ascii', 0, 4), 'RIFF');
  assert.equal(header.readUInt32LE(4) + 8, file.size);
  assert.equal(header.toString('ascii', 8, 16), 'WAVEfmt ');
  assert.equal(header.readUInt16LE(20), 1); assert.equal(header.readUInt16LE(22), 2);
  assert.equal(header.readUInt32LE(24), 44100); assert.equal(header.readUInt16LE(34), 16);
  assert.equal(header.readUInt32LE(40), 44100 * 2 * 4);
  const digest = createHash('sha256');
  for (let offset = 0; offset < file.size; offset += 7919) digest.update(nativeAudioChunk(file, offset, Math.min(7919, file.size - offset)));
  assert.equal(digest.digest('hex'), nativeAudioDigest(file));
  assert.equal(nativeAudioDigest(file), 'ff580c0972d67d5f9d4631d5c16d86c9813d71c89f74a1d2ba5a5b213d42f6ea');
});

test('equal-size corrupt control retains an invalid all-zero payload and distinct digest', () => {
  const [valid, corrupt] = nativeAudioFiles;
  assert.equal(valid.size, corrupt.size);
  assert.deepEqual(nativeAudioChunk(corrupt, 0, 44), Buffer.alloc(44));
  assert.equal(nativeAudioDigest(corrupt), createHash('sha256').update(Buffer.alloc(valid.size)).digest('hex'));
  assert.notEqual(nativeAudioDigest(valid), nativeAudioDigest(corrupt));
});

test('audio ranges refuse fabricated descriptors, nonintegral, oversized and escaping requests', () => {
  const file = nativeAudioFiles[0];
  for (const [target, offset, length] of [[{ ...file }, 0, 1], [file, -1, 1], [file, 0, 0],
    [file, 0, 16385], [file, file.size, 1], [file, 0.5, 1], [file, 0, Infinity]]) {
    assert.throws(() => nativeAudioChunk(target, offset, length), TypeError);
  }
  assert.throws(() => nativeAudioDigest({ ...file }), TypeError);
});
