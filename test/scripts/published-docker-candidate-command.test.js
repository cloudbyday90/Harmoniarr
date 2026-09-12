/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublishedCandidateCommand } from '../../scripts/published-docker-candidate-command.js';

test('published trust commands use a hidden process, bounded output and no shell', async () => {
  const env = { GH_TOKEN: 'test-token' };
  const run = createPublishedCandidateCommand({ execFileFn: async (command, args, options) => {
    assert.equal(command, 'gh');
    assert.deepEqual(args, ['attestation', 'verify', 'oci://example/image@sha256:abc']);
    assert.equal(options.env, env);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.maxBuffer, 1_048_576);
    assert.equal(options.timeout, 90_000);
    return { stdout: '[]', stderr: 'private diagnostic' };
  } });
  assert.deepEqual(await run({ args: ['attestation', 'verify', 'oci://example/image@sha256:abc'], env, timeoutMs: 90_000 }),
    { exitCode: 0, stdout: '[]' });
});

test('published trust rejects mutation and unrelated executable commands', async () => {
  const run = createPublishedCandidateCommand({ execFileFn: async () => { assert.fail('No process should start'); } });
  for (const options of [
    { args: ['release', 'upload', 'v1', 'asset'] },
    { args: ['api', '--method', 'POST', 'repos/example/image/releases'] },
    { args: ['api', '--method', 'GET', '--method', 'POST', 'repos/example/image/releases'] },
    { args: ['api', '--method', 'GET', '-X', 'POST', 'repos/example/image/releases'] },
    { args: ['api', '--method', 'GET', '--method=POST', 'repos/example/image/releases'] },
    { command: 'docker', args: ['attestation', 'verify', 'image'] },
    { args: ['api', 'repos/example/image'] },
  ]) await assert.rejects(run(options), /read-only/u);
});

test('published trust sanitizes process failure and never returns unverified stdout', async () => {
  const run = createPublishedCandidateCommand({ execFileFn: async () => {
    throw Object.assign(new Error('private command and token'), { code: 1, stdout: '{"verified":true}', stderr: 'private token' });
  } });
  await assert.rejects(run({ args: ['attestation', 'verify', 'image'] }), (error) =>
    error.code === 'published_candidate_trust_command_failed' && !error.message.includes('private'));
});
