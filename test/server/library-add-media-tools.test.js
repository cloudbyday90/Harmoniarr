/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createLibraryAddMediaFixture } from '../../testing/integration/library-add-media-tools.js';

const executeFile = promisify(execFile);

test('fresh media tools, option policy and scoped adapter load without database or application modules', async () => {
  const root = new URL('../../', import.meta.url).href;
  const script = `
    import { registerHooks } from 'node:module';
    const root = ${JSON.stringify(root)};
    const server = new URL('src/server/', root).href;
    const cleanup = new URL('worker-task-cleanup.js', server).href;
    const hooks = registerHooks({ resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (specifier === 'pg' || specifier.startsWith('pg/')
        || (result.url.startsWith(server) && result.url !== cleanup)) throw new Error('Unexpected application/database dependency');
      return result;
    } });
    try {
      const options = await import(new URL('testing/integration/library-add-media-options.js', root));
      if (options.resolveLibraryAddMediaOptions({}).mode !== 'per-command') throw new Error('Changed default');
      await import(new URL('testing/integration/library-add-media-tools.js', root));
      await import(new URL('testing/integration/library-add-media-scenario.js', root));
      process.stdout.write('isolated');
    } finally { hooks.deregister(); }
  `;
  const result = await executeFile(process.execPath, ['--input-type=module', '-e', script],
    { timeout: 10_000, maxBuffer: 16 * 1024, windowsHide: true });
  assert.equal(result.stdout, 'isolated');
});

test('local media commands retain their real returned executable output without a Docker dependency', async () => {
  const media = createLibraryAddMediaFixture({ mediaImage: null });
  const result = await media.mediaCommand(process.execPath, ['-e', 'process.stdout.write("current local command")']);
  assert.equal(result.stdout, 'current local command'); assert.equal(result.stderr, '');
});

test('only ffprobe delegates to the supplied scenario owner; other local commands execute independently', async () => {
  const calls = []; const expected = { stdout: '{"streams":[]}', stderr: '' };
  const media = createLibraryAddMediaFixture({ mediaImage: null, inspectionExecutor: {
    run: async (...args) => { calls.push(args); return expected; },
  } });
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '/controlled/current.wav'];
  assert.equal(await media.mediaCommand('ffprobe', args), expected);
  assert.deepEqual(calls, [['ffprobe', args, { readonly: true }]]);
  assert.equal((await media.mediaCommand(process.execPath, ['-e', 'process.stdout.write("separate")'], { readonly: false })).stdout, 'separate');
  assert.equal(calls.length, 1);
});

test('Docker fixture paths outside the scenario are refused before native dispatch', async () => {
  const root = join(tmpdir(), 'harmoniarr-media-scope');
  const media = createLibraryAddMediaFixture({ getFixtureRoot: () => root, mediaImage: 'must-not-start' });
  await assert.rejects(media.mediaCommand('ffprobe', [join(root, '..', 'outside.wav')]),
    error => error.code === 'ERR_ASSERTION' && error.message.includes('test-owned workspace'));
});
