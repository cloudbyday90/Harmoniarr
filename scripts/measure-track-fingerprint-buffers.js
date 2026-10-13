/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createLibraryAddMediaFixture } from '../testing/integration/library-add-media-fixtures.js';
import { runFingerprintBufferProbe } from '../testing/integration/fingerprint-buffer-process.js';
import { OPERATOR_TRACK_READ_BUFFER_OPTIONS, OPERATOR_TRACK_READ_METHODS } from '../src/server/metadata/operator-track-fingerprint-policy.js';
import { fingerprintOperatorTrackFile } from '../src/server/metadata/operator-track-file-evidence-service.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') throw new TypeError('Usage: node scripts/measure-track-fingerprint-buffers.js --output <local JSON>');
const workspace = await mkdtemp(join(tmpdir(), 'harmoniarr-fingerprint-profile-')); const rows = [];
if (dirname(workspace) !== resolve(tmpdir()) || !basename(workspace).startsWith('harmoniarr-fingerprint-profile-')) throw new Error('Unexpected owned workspace');
let safeCleanup = true;
const controller = new AbortController();
const cancel = () => controller.abort(new Error('Fingerprint measurement cancelled'));
process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
const media = createLibraryAddMediaFixture({ getFixtureRoot: () => workspace });
try {
  const unavailable = await media.verifyTooling(); if (unavailable) throw new Error(unavailable);
  for (const profile of ['sine', 'noise']) {
    controller.signal.throwIfAborted();
    const path = join(workspace, `${profile}.flac`); const noise = profile === 'noise';
    await media.mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
      noise ? 'anoisesrc=color=white:seed=42:sample_rate=192000' : 'sine=frequency=1000:sample_rate=44100',
      '-t', noise ? '30' : '2', '-ac', '2', '-c:a', 'flac', ...(noise ? ['-sample_fmt', 's32', '-compression_level', '0'] : []),
      '-metadata', 'title=Controlled fingerprint profile', path], { readonly: false });
    controller.signal.throwIfAborted();
    const expected = await fingerprintOperatorTrackFile(path, { libraryRoot: workspace, readBufferBytes: 64 * 1024, readMethod: 'stream' });
    for (let round = 0; round < 6; round++) {
      const options = OPERATOR_TRACK_READ_METHODS.flatMap(readMethod => OPERATOR_TRACK_READ_BUFFER_OPTIONS.map(readBufferBytes => ({ readMethod, readBufferBytes })));
      const offset = round % options.length;
      for (const { readBufferBytes, readMethod } of [...options.slice(offset), ...options.slice(0, offset)]) {
        controller.signal.throwIfAborted(); safeCleanup = false;
        const result = await runFingerprintBufferProbe({ filePath: path, libraryRoot: workspace, readBufferBytes, readMethod, signal: controller.signal,
          onTermination: ({ quiescent }) => { safeCleanup = quiescent; } });
        safeCleanup = true;
        assert.deepEqual(result.evidence, expected); assert.equal(result.hashedBytes, expected.sizeBytes * result.passes);
        const { evidence: _evidence, ...measurement } = result;
        rows.push({ profile, round, sizeBytes: expected.sizeBytes, ...measurement });
      }
    }
  }
  controller.signal.throwIfAborted();
  await writeFile(args[1], JSON.stringify({ version: 1, node: process.version, samples: rows }, null, 2));
  const recorded = JSON.parse(await readFile(args[1], 'utf8')); assert.equal(recorded.samples.length, 72);
  console.log(JSON.stringify({ profiles: 2, samples: rows.length, outputWritten: true }));
} finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  if (safeCleanup) await rm(workspace, { recursive: true, force: true });
}
