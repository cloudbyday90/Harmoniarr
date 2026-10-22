/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import certificates from '../fixtures/provider-https/public-test-certificates.json' with { type: 'json' };
import { runProviderHttpsChild } from './provider-https-child-runner.js';

const authorities = new Set(['api.spotify.com:443', 'accounts.spotify.com:443', 'www.googleapis.com:443',
  'oauth2.googleapis.com:443', 'api.music.apple.com:443', 'ws.audioscrobbler.com:443', 'musicbrainz.org:443',
  '127.0.0.1:443', 'redirect-sink.example.invalid:443']);

/** Public certificates only. The proxy never resolves or connects to the requested authority. */
export async function withProviderHttpsFixture({ profile = 'matched', handler, signal, consumerUrl }, run) {
  if (!['matched', 'mismatched'].includes(profile)) throw new TypeError('Invalid HTTPS fixture profile');
  signal?.throwIfAborted();
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-provider-https-'));
  const sockets = new Map();
  const servers = [];
  const children = new Set();
  const retirement = new AbortController();
  const childSignal = signal ? AbortSignal.any([signal, retirement.signal]) : retirement.signal;
  let admissionOpen = true;
  const records = { connections: 0, tunnels: [], requests: [], tlsErrors: [] };
  const ownSocket = socket => {
    if (sockets.has(socket)) return;
    const closed = new Promise(resolve => { socket.once('close', resolve); });
    sockets.set(socket, closed);
    socket.on('error', () => {});
  };
  const listen = async server => {
    servers.push(server);
    server.on('connection', ownSocket);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return server.address().port;
  };
  return withWorkerTaskCleanup(async () => {
    const caFile = join(root, 'public-test-ca.pem');
    await writeFile(caFile, certificates.ca, { mode: 0o600, flag: 'wx' });
    const tls = createHttpsServer(certificates[profile], (req, res) => {
      records.requests.push({ method: req.method, url: req.url, host: req.headers.host,
        servername: req.socket.servername, headers: req.headers });
      req.resume();
      handler(req, res);
    });
    tls.on('secureConnection', ownSocket);
    tls.on('connection', () => { records.connections++; });
    tls.on('tlsClientError', error => { records.tlsErrors.push(error.code); });
    const tlsPort = await listen(tls);
    const proxy = createHttpServer((_req, res) => { res.writeHead(405).end(); });
    proxy.on('connect', (req, downstream, head) => {
      records.tunnels.push(req.url);
      if (!authorities.has(req.url)) { downstream.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
      const upstream = connect({ host: '127.0.0.1', port: tlsPort });
      ownSocket(upstream);
      downstream.once('close', () => upstream.destroy());
      upstream.once('close', () => downstream.destroy());
      upstream.once('error', () => downstream.destroy());
      upstream.once('connect', () => {
        downstream.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        downstream.pipe(upstream); upstream.pipe(downstream);
      });
    });
    const proxyPort = await listen(proxy);
    return run({ records, runClient: (scenario, { trust = true } = {}) => {
      if (!admissionOpen) return Promise.reject(new Error('Provider HTTPS fixture is retired'));
      const task = runProviderHttpsChild({ proxyUrl: `http://127.0.0.1:${proxyPort}`,
        caFile: trust ? caFile : null, scenario, signal: childSignal, consumerUrl });
      children.add(task);
      void task.then(() => children.delete(task), () => children.delete(task));
      return task;
    } });
  }, async () => {
    admissionOpen = false;
    const unawaited = children.size > 0;
    retirement.abort(new Error('Owned provider HTTPS fixture retirement'));
    await Promise.allSettled([...children]);
    const closes = servers.filter(server => server.listening).map(server => new Promise((resolve, reject) => {
      server.close(error => { if (error) reject(error); else resolve(); });
    }));
    for (const socket of sockets.keys()) socket.destroy();
    const settled = await Promise.allSettled([...closes, ...sockets.values()]);
    const failed = settled.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    await rm(root, { recursive: true });
    if (servers.some(server => server.listening) || [...sockets.keys()].some(socket => !socket.closed)) {
      throw new Error('Provider HTTPS fixture retirement was not verified');
    }
    if (unawaited) throw new Error('Provider HTTPS child work was not awaited');
  });
}
