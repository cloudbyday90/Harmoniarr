/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { Agent, request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { isPublicAddress } from '../../network/public-address-policy.js';
import { admitPlexDestination, plexMaxHeaderBytes, plexHttpError, validatePlexResponseHeaders } from './plex-http-policy.js';

/** Direct fixed-origin HTTPS. Drain includes native closes and every issued DNS callback. */
export function createPlexHttpsTransport({ requestFn = request, lookupFn = lookup } = {}) {
  return { startRequest(value, { method, headers, maxBytes, signal, check }) {
    const url = admitPlexDestination(value), agent = new Agent({ keepAlive: false, proxyEnv: {} });
    const completion = Promise.withResolvers(), requestClosed = Promise.withResolvers();
    const closes = [], dns = []; let outgoing, incoming, settled = false, finished = false;
    function destroy() { incoming?.destroy(); outgoing?.destroy(); agent.destroy(); }
    function finish(error, result) {
      if (settled) return;
      settled = true; destroy();
      if (error) completion.reject(error); else completion.resolve(result);
    }
    const abort = () => finish(plexHttpError('timeout'));
    const ownedLookup = (hostname, options, callback) => {
      const done = Promise.withResolvers(); dns.push(done.promise);
      try {
        if (hostname !== url.hostname || signal.aborted) { callback(plexHttpError('unavailable')); done.resolve(); return; }
        lookupFn(hostname, { ...options, all: true }, (error, answers) => {
          try {
            if (error || signal.aborted || !Array.isArray(answers) || !answers.length || answers.length > 64
              || !answers.every(answer => isIP(answer.address) === answer.family && isPublicAddress(answer.address))) callback(plexHttpError('unavailable'));
            else if (options?.all) callback(null, answers.map(({ address, family }) => ({ address, family })));
            else callback(null, answers[0].address, answers[0].family);
          } finally { done.resolve(); }
        });
      } catch { done.resolve(); callback(plexHttpError('unavailable')); }
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      check();
      outgoing = requestFn(url, { method, headers: { ...headers, Connection: 'close' }, agent, lookup: ownedLookup,
        servername: url.hostname, rejectUnauthorized: true, maxHeaderSize: plexMaxHeaderBytes, signal,
        family: 0, autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 }, response => {
        incoming = response; const closed = Promise.withResolvers(); closes.push(closed.promise);
        incoming.once('close', () => { closed.resolve(); if (!finished) finish(plexHttpError('invalid')); });
        incoming.on('error', () => finish(plexHttpError('invalid')));
        try {
          check();
          const status = incoming.statusCode, responseHeaders = new Headers(incoming.headers);
          validatePlexResponseHeaders(status, responseHeaders, maxBytes);
          if (status < 200 || status >= 300) { finished = true; finish(null, { status, headers: responseHeaders, body: Buffer.alloc(0) }); return; }
          const chunks = []; let bytes = 0;
          incoming.on('data', chunk => {
            if (settled) return;
            try { check(); bytes += chunk.byteLength; if (bytes > maxBytes) throw plexHttpError('oversized'); chunks.push(chunk); }
            catch (error) { finish(error); }
          });
          incoming.once('end', () => {
            if (settled) return;
            try { check(); if (!incoming.complete) throw plexHttpError('invalid'); finished = true; finish(null, { status, headers: responseHeaders, body: Buffer.concat(chunks, bytes) }); }
            catch (error) { finish(error); }
          });
        } catch (error) { finish(error); }
      });
      outgoing.once('socket', socket => { const closed = Promise.withResolvers(); closes.push(closed.promise); socket.once('close', () => closed.resolve()); });
      outgoing.on('error', () => finish(plexHttpError('unavailable')));
      outgoing.on('upgrade', (response, socket) => { response.destroy(); socket.destroy(); finish(plexHttpError('invalid')); });
      outgoing.once('close', () => { requestClosed.resolve(); if (!settled) finish(plexHttpError('unavailable')); });
      if (signal.aborted) abort(); else outgoing.end();
    } catch (error) { finish(error); if (!outgoing) requestClosed.resolve(); }
    const drained = completion.promise.then(() => {}, () => {}).then(async () => {
      await requestClosed.promise; await Promise.all([...closes, ...dns]); signal.removeEventListener('abort', abort); return true;
    });
    return { result: completion.promise, drained };
  } };
}
