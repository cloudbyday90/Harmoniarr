/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */


import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeAudioFiles, nativeAudioChunk, nativeAudioDigest } from '../../testing/slskd/native-audio-data.js';
import { exportNativeAudioFile } from '../../testing/slskd/native-audio-export.js';

async function scenario(t) {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-audio-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const downloadsRoot = join(root, 'downloads'); await mkdir(downloadsRoot);
  const file = nativeAudioFiles[0]; const parts = file.filename.split('\\');
  const path = join(downloadsRoot, ...parts);
  const chunks = [];
  for (let offset = 0; offset < file.size; offset += 16384) chunks.push(nativeAudioChunk(file, offset, Math.min(16384, file.size - offset)));
  const bytes = Buffer.concat(chunks); let calls = 0;
  const docker = async args => { calls++; assert.deepEqual(args, ['cp', 'fixture:/downloads/' + parts.join('/'), path]); await writeFile(path, bytes); };
  return { root, path, file, bytes, calls: () => calls, input: { docker, fixtureId: 'fixture', downloadsRoot, file,
    native: { filename: file.filename, size: file.size, sha256: nativeAudioDigest(file), identityStable: true } } };
}

test('export reopens bounded actual bytes and joins native and host identity by hash', async t => {
  const s = await scenario(t); const result = await exportNativeAudioFile(s.input);
  assert.equal(result.size, s.file.size); assert.equal(result.sha256, nativeAudioDigest(s.file));
  assert.equal(result.identityStable, true); assert.equal(s.calls(), 1);
});

test('export refuses overwrite before Docker and preserves existing content', async t => {
  const s = await scenario(t); await mkdir(join(s.input.downloadsRoot, 'NativeAudioValid'));
  await writeFile(s.path, 'existing');
  await assert.rejects(exportNativeAudioFile(s.input));
  assert.equal(s.calls(), 0); assert.equal(await readFile(s.path, 'utf8'), 'existing');
});

test('export refuses a redirected parent and never writes through its junction', async t => {
  const s = await scenario(t); const outside = join(s.root, 'outside'); await mkdir(outside);
  await symlink(outside, join(s.input.downloadsRoot, 'NativeAudioValid'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(exportNativeAudioFile(s.input)); assert.equal(s.calls(), 0);
});

test('export refuses fabricated manifest and changed native hash before Docker', async t => {
  const s = await scenario(t);
  await assert.rejects(exportNativeAudioFile({ ...s.input, file: { ...s.file } }));
  await assert.rejects(exportNativeAudioFile({ ...s.input, native: { ...s.input.native, sha256: '0'.repeat(64) } }));
  assert.equal(s.calls(), 0);
});

test('export rejects equal-size changed bytes, overlong bytes and hardlinked copies', async t => {
  const s = await scenario(t);
  for (const kind of ['changed', 'overlong', 'hardlink']) {
    await assert.rejects(exportNativeAudioFile({ ...s.input, docker: async () => {
      if (kind === 'hardlink') {
        const shared = join(s.root, 'shared'); await writeFile(shared, s.bytes); await link(shared, s.path);
      } else await writeFile(s.path, kind === 'changed' ? Buffer.alloc(s.file.size) : Buffer.concat([s.bytes, Buffer.from([0])]));
    } }));
    await rm(s.path);
  }
});

test('export preserves a Docker Error or null failure without publishing success', async t => {
  const s = await scenario(t);
  for (const failure of [new Error('controlled copy failure'), null]) {
    await assert.rejects(exportNativeAudioFile({ ...s.input, docker: async () => { throw failure; } }), error => error === failure);
  }
});
