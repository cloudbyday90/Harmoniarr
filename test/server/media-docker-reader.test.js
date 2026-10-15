/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mediaDockerSocketPath, resolveMediaDockerEndpoint } from '../../testing/integration/media-docker-endpoint-policy.js';
import { createMediaDockerJsonReader } from '../../testing/integration/media-docker-json-reader.js';
import { createMediaDockerInspectionReader } from '../../testing/integration/media-docker-inspection-reader.js';
import { disabledMediaTransportObserver } from '../../testing/integration/media-transport-phase-observer.js';

const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function socketFixture(handler, work, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-http-'));
  const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\harmoniarr-read-${randomUUID()}` : join(directory, 'engine.sock');
  const server = createServer(handler); const connections = new Set();
  server.on('connection', socket => { connections.add(socket); socket.once('close', () => connections.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  const reader = createMediaDockerJsonReader({ socketPath, ...options });
  try { await work(reader); }
  finally {
    await reader.close(); for (const socket of connections) socket.destroy();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    await rm(directory, { recursive: true, force: true });
  }
}

test('local endpoint parsing refuses remote, ambiguous, escaped and cross-platform authorities', () => {
  assert.equal(mediaDockerSocketPath('npipe:////./pipe/dockerDesktopLinuxEngine', 'win32'), '\\\\.\\pipe\\dockerDesktopLinuxEngine');
  assert.equal(mediaDockerSocketPath('unix:///var/run/docker.sock', 'linux'), '/var/run/docker.sock');
  for (const host of ['tcp://localhost:2375', 'ssh://user@host', 'unix://host/socket', 'unix:///a/../b',
    'unix:///a%2fb', 'unix:///a?b', 'npipe:////remote/pipe/docker_engine', 'npipe:////./pipe/a/b']) {
    assert.throws(() => mediaDockerSocketPath(host, 'linux'), { code: 'fixture_media_endpoint_refused' });
    assert.throws(() => mediaDockerSocketPath(host, 'win32'), { code: 'fixture_media_endpoint_refused' });
  }
});

test('context precedence is captured and later CLI calls are pinned independently of selected context', async () => {
  const original = { DOCKER_CONTEXT: 'owned', DOCKER_HOST: 'tcp://ignored:2375', PRIVATE_VALUE: 'keep-private' }; const calls = [];
  const endpoint = await resolveMediaDockerEndpoint({ env: original, platform: 'linux', invoke: async (phase, args) => {
    calls.push(args); return { stdout: args[1] === 'show' ? 'owned' : JSON.stringify([{ Name: 'owned', TLSMaterial: {},
      Endpoints: { docker: { Host: 'unix:///owned.sock', SkipTLSVerify: false } } }]) };
  } });
  original.DOCKER_CONTEXT = 'changed';
  assert.deepEqual(calls, [['context', 'show'], ['context', 'inspect', 'owned']]);
  assert.equal(endpoint.socketPath, '/owned.sock'); assert.equal(endpoint.env.DOCKER_HOST, 'unix:///owned.sock');
  assert.equal(endpoint.env.DOCKER_CONTEXT, undefined); assert.equal(endpoint.env.PRIVATE_VALUE, 'keep-private');
  assert.equal(Object.isFrozen(endpoint.env), true);
  const direct = await resolveMediaDockerEndpoint({ env: { DOCKER_HOST: 'unix:///direct.sock' }, platform: 'linux', invoke: () => assert.fail() });
  assert.equal(direct.socketPath, '/direct.sock');
  for (const key of ['DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']) {
    await assert.rejects(resolveMediaDockerEndpoint({ env: { [key]: 'configured' }, invoke: () => assert.fail() }), { code: 'fixture_media_endpoint_refused' });
  }
});

test('fragmented current JSON is complete and the connection is reused only for reviewed GET paths', () => {
  let connections = 0; let first;
  return socketFixture((req, res) => {
    assert.equal(req.method, 'GET'); assert.equal(req.url, '/v1.56/info');
    if (!first) { first = req.socket; connections++; } else assert.equal(req.socket, first);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"ID":'); setImmediate(() => res.end('"current"}'));
  }, async reader => {
    for (let i = 0; i < 2; i++) assert.deepEqual(await reader.get('/v1.56/info'), { ID: 'current' });
    assert.equal(connections, 1);
    await assert.rejects(reader.get('/v1.56/containers/short/json'), { code: 'fixture_media_read_refused' });
    await assert.rejects(reader.get('/v1.56/containers/create'), { code: 'fixture_media_read_refused' });
    const closing = reader.close(); assert.equal(reader.close(), closing); await closing;
    await assert.rejects(reader.get('/v1.56/info'), { code: 'fixture_media_reader_closed' });
  });
});

for (const mode of ['oversized', 'declared-oversized', 'malformed', 'early-close', 'status', 'redirect', 'encoding', 'stalled-headers', 'stalled-body']) {
  test(`bounded HTTP reader refuses ${mode} and drains its connection`, () => socketFixture((req, res) => {
    if (mode === 'stalled-headers') return;
    res.writeHead(mode === 'status' ? 500 : mode === 'redirect' ? 302 : 200, { 'Content-Type': 'application/json',
      ...(mode === 'declared-oversized' ? { 'Content-Length': '1000' } : {}), ...(mode === 'encoding' ? { 'Content-Encoding': 'gzip' } : {}) });
    if (mode === 'early-close') { res.write('{'); setImmediate(() => res.destroy()); }
    else if (mode === 'stalled-body') res.write('{');
    else res.end(mode === 'oversized' ? ' '.repeat(1000) : '{');
  }, async reader => { await assert.rejects(reader.get('/v1.56/info')); }, { timeoutMs: 80, maxBytes: 128 }));
}

for (const reason of [new Error('private-original'), null]) {
  test(`abort preserves ${reason === null ? 'null' : 'Error'} and close drains admitted work`, async () => {
    const entered = gate();
    await socketFixture((req, res) => { entered.release(); }, async reader => {
      const controller = new AbortController(); const failed = assert.rejects(reader.get('/v1.56/info', controller.signal), error => error === reason);
      await entered.promise;
      await assert.rejects(reader.get('/v1.56/info'), { code: 'fixture_media_reader_closed' });
      const closing = reader.close(); let closed = false; closing.then(() => { closed = true; });
      await assert.rejects(reader.get('/v1.56/info'), { code: 'fixture_media_reader_closed' });
      await new Promise(resolve => { setImmediate(resolve); }); assert.equal(closed, false);
      controller.abort(reason); await failed; await closing; assert.equal(closed, true);
    });
  });
}

for (const mismatch of ['daemon', 'version', 'unsupported', 'none']) {
  test(`bootstrap ${mismatch} privately compares daemon and capability before granting inspection`, async () => {
    const version = { Version: '29.8.2', ApiVersion: '1.56', MinAPIVersion: '1.40', Os: 'linux' };
    let pinned; let closed = false; const paths = [];
    const creating = createMediaDockerInspectionReader({ platform: 'linux', env: { DOCKER_HOST: 'unix:///engine.sock' },
      transportObserver: disabledMediaTransportObserver, setEnvironment: value => { pinned = value; },
      invoke: async (phase, args) => ({ stdout: args[0] === 'version' ? JSON.stringify({ ...version,
        ...(mismatch === 'unsupported' ? { ApiVersion: '1.55' } : {}) }) : 'private-daemon' }),
      createReader: () => ({ get: async path => {
        paths.push(path);
        return path.endsWith('/version') ? { ...version, ...(mismatch === 'version' ? { Version: 'different' } : {}) }
          : path.endsWith('/info') ? { ID: mismatch === 'daemon' ? 'different' : 'private-daemon' } : { Id: 'a'.repeat(64) };
      }, close: async () => { closed = true; } }),
    });
    if (mismatch !== 'none') { await assert.rejects(creating); assert.equal(closed, mismatch !== 'unsupported'); }
    else {
      const reader = await creating; assert.equal(pinned.DOCKER_HOST, 'unix:///engine.sock');
      await assert.rejects(reader.inspect('short'), { code: 'fixture_media_owner_unknown' });
      assert.deepEqual(await reader.inspect('a'.repeat(64)), { Id: 'a'.repeat(64) }); await reader.close(); assert.equal(closed, true);
      assert.equal(paths.length, 3);
    }
  });
}
