/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDockerSmokePortBindings, resolveDockerSmokeEndpoint } from '../../scripts/docker-smoke-endpoint.js';

const mapping = (HostPort = '45123', HostIp = '127.0.0.1') => ({ '3000/tcp': [{ HostIp, HostPort }] });

test('Docker smoke endpoint accepts one assigned loopback binding and unexposed ports', () => {
  for (const port of ['1', '45123', '65535']) {
    assert.deepEqual(parseDockerSmokePortBindings(JSON.stringify({ ...mapping(port), '5432/tcp': null })),
      { baseUrl: `http://127.0.0.1:${port}`, port: Number(port) });
  }
});

test('Docker smoke endpoint refuses ambiguous, remote and malformed mappings without disclosing input', () => {
  const canary = 'private-command-output';
  const invalid = [null, [], {}, { '3000/tcp': null }, { '3000/tcp': [] },
    { '3000/tcp': [mapping()['3000/tcp'][0], mapping()['3000/tcp'][0]] },
    { ...mapping(), '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '5432' }] },
    ...['0.0.0.0', '::', '::1', 'localhost', '127.0.0.2', canary].map(host => mapping('45123', host)),
    ...['0', '65536', '99999', '01', '-1', '1.2', '45123\n', '1e3', canary, 45123, null].map(port => mapping(port)),
  ].map(value => JSON.stringify(value));
  invalid.push(canary, 'x'.repeat(4097), undefined);
  for (const output of invalid) {
    assert.throws(() => parseDockerSmokePortBindings(output), error => {
      assert.equal(error.message.includes(canary), false);
      return /Docker smoke endpoint/u.test(error.message);
    });
  }
});

test('Docker smoke endpoint inspects only the single acknowledged project service container', async () => {
  const containerId = 'a'.repeat(64);
  const composeArgs = ['compose', '-f', 'base.yaml', '-f', 'smoke.yaml', '-p', 'owned-smoke'];
  const env = { HARMONIARR_PORT: '0' };
  const calls = [];
  const endpoint = await resolveDockerSmokeEndpoint({ composeArgs, env, runCommandFn: async request => {
    calls.push(request);
    return { exitCode: 0, stdout: calls.length === 1 ? `${containerId}\n` : JSON.stringify(mapping()) };
  } });
  assert.deepEqual(endpoint, { containerId, baseUrl: 'http://127.0.0.1:45123', port: 45123 });
  assert.deepEqual(calls, [
    { command: 'docker', args: [...composeArgs, 'ps', '-q', 'harmoniarr'], env },
    { command: 'docker', args: ['inspect', '--type', 'container', '--format', '{{json .NetworkSettings.Ports}}', containerId], env },
  ]);
});

test('Docker smoke endpoint refuses missing or multiple service identities before inspection', async () => {
  for (const stdout of ['', 'name-not-id', `${'a'.repeat(64)}\n${'b'.repeat(64)}`, undefined]) {
    let calls = 0;
    await assert.rejects(resolveDockerSmokeEndpoint({ composeArgs: [], env: {}, runCommandFn: async () => {
      calls++;
      return { exitCode: 0, stdout };
    } }), /one acknowledged service container/u);
    assert.equal(calls, 1);
  }
});

test('Docker smoke endpoint refuses nonzero CLI results and preserves thrown failures', async () => {
  for (const failureAt of [1, 2]) {
    let calls = 0;
    await assert.rejects(resolveDockerSmokeEndpoint({ composeArgs: [], runCommandFn: async () => {
      return { exitCode: ++calls === failureAt ? 1 : 0, stdout: 'a'.repeat(64) };
    } }), /Docker smoke endpoint/u);
  }
  for (const failure of [new Error('original command failure'), null]) {
    let caught = false;
    try { await resolveDockerSmokeEndpoint({ composeArgs: [], runCommandFn: async () => { throw failure; } }); }
    catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true);
  }
});
