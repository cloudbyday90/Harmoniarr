/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { Agent, request } from 'node:http';
import { mediaExecutorError } from './owned-media-inspection-policy.js';

/** One admitted GET at a time, an absolute deadline, and a bounded complete JSON body. */
export function createMediaDockerJsonReader({ socketPath, timeoutMs = 30_000, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (typeof socketPath !== 'string' || !socketPath || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024) throw new TypeError('Invalid media reader');
  const agent = new Agent({ keepAlive: true, maxSockets: 1, maxTotalSockets: 1, maxFreeSockets: 1 });
  const sockets = new Map(); let active; let sealed = false; let closing;
  function get(path, signal) {
    if (sealed || active) return Promise.reject(mediaExecutorError('fixture_media_reader_closed'));
    if (!/^\/v1\.56\/(?:version|info|containers\/[a-f0-9]{64}\/json)$/u.test(path)) {
      return Promise.reject(mediaExecutorError('fixture_media_read_refused'));
    }
    let operation;
    operation = new Promise((resolve, reject) => {
      let req; let response; let timer; let failed = false; let failure; let ended = false; let result;
      const fail = error => {
        if (!failed) { failed = true; failure = error; }
        response?.destroy(); req?.destroy(); req?.socket?.destroy();
      };
      const abort = () => fail(signal.reason);
      if (signal?.aborted) { reject(signal.reason); return; }
      req = request({ socketPath, path, method: 'GET', agent, maxHeaderSize: 16 * 1024,
        headers: { Accept: 'application/json' } });
      req.on('socket', socket => {
        if (!sockets.has(socket)) sockets.set(socket, new Promise(done => { socket.once('close', () => { sockets.delete(socket); done(); }); }));
      });
      req.on('error', fail);
      req.once('close', () => {
        if (!failed && !ended) fail(mediaExecutorError('fixture_media_read_incomplete'));
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        // A failed operation owns the socket until its actual close, not merely request destruction.
        const drain = failed ? Promise.all([...sockets.values()]) : Promise.resolve();
        drain.then(() => {
          if (active === operation) active = undefined;
          if (failed) reject(failure);
          else resolve(result);
        });
      });
      req.once('response', incoming => {
        response = incoming;
        const chunks = []; let size = 0;
        if (incoming.statusCode !== 200 || !/^application\/json(?:;|$)/iu.test(incoming.headers['content-type'] ?? '')
          || incoming.headers['content-encoding'] || Number(incoming.headers['content-length'] ?? 0) > maxBytes) {
          fail(mediaExecutorError('fixture_media_read_refused')); return;
        }
        incoming.on('error', fail);
        incoming.once('aborted', () => fail(mediaExecutorError('fixture_media_read_incomplete')));
        incoming.on('data', chunk => {
          size += chunk.length;
          if (size > maxBytes) fail(mediaExecutorError('fixture_media_read_limit'));
          else chunks.push(chunk);
        });
        incoming.once('end', () => {
          if (failed) return;
          if (!incoming.complete) { fail(mediaExecutorError('fixture_media_read_incomplete')); return; }
          try { result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); ended = true; }
          catch { fail(mediaExecutorError('fixture_media_read_json')); }
        });
      });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => fail(mediaExecutorError('fixture_media_read_timeout')), timeoutMs);
      req.end();
    });
    active = operation;
    // Covers pre-aborted and synchronous request construction failures as well.
    operation.then(() => { if (active === operation) active = undefined; }, () => { if (active === operation) active = undefined; });
    return operation;
  }
  function close() {
    sealed = true;
    return closing ??= (async () => {
      if (active) { try { await active; } catch { /* The caller retains its original read failure. */ } }
      const drains = [...sockets.values()]; agent.destroy(); await Promise.all(drains);
    })();
  }
  return Object.freeze({ get, close });
}
