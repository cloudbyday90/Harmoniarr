/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { Agent, request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { isPublicAddress } from './public-address-policy.js';

/** Direct HTTPS ownership includes actual native closes and every issued DNS callback. */
export function createOwnedHttpsTransport({ admitDestination, createError, readResponse, requestFn = request, lookupFn = lookup }) {
  return { kind: 'native', startRequest(value, { method, headers, body, maxBytes, signal, check }) {
    const url = admitDestination(value), agent = new Agent({ keepAlive: false, proxyEnv: {} });
    const completion = Promise.withResolvers(), requestClosed = Promise.withResolvers(), closes = [], dns = [];
    let outgoing, incoming, reader, settled = false;
    const destroy = () => { reader?.cancel(); incoming?.destroy(); outgoing?.destroy(); agent.destroy(); };
    function finish(error, result) {
      if (settled) return;
      settled = true; destroy();
      if (error) completion.reject(error); else completion.resolve(result);
    }
    const abort = () => finish(createError('timeout'));
    const ownedLookup = (hostname, options, callback) => {
      const done = Promise.withResolvers(); dns.push(done.promise);
      try {
        if (hostname !== url.hostname || signal.aborted) { callback(createError('unavailable')); done.resolve(); return; }
        lookupFn(hostname, { ...options, all: true }, (error, answers) => {
          try {
            if (error || signal.aborted || !Array.isArray(answers) || !answers.length || answers.length > 64
              || !answers.every(answer => isIP(answer.address) === answer.family && isPublicAddress(answer.address))) callback(createError('unavailable'));
            else if (options?.all) callback(null, answers.map(({ address, family }) => ({ address, family })));
            else callback(null, answers[0].address, answers[0].family);
          } finally { done.resolve(); }
        });
      } catch { done.resolve(); callback(createError('unavailable')); }
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      check();
      outgoing = requestFn(url, { method, headers: { ...headers, Connection: 'close' }, agent, lookup: ownedLookup,
        servername: url.hostname, rejectUnauthorized: true, maxHeaderSize: 16_384, signal,
        family: 0, autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 }, response => {
        incoming = response; const closed = Promise.withResolvers(); closes.push(closed.promise); incoming.once('close', closed.resolve);
        incoming.on('error', () => { if (!reader) finish(createError('invalid')); });
        try { check(); reader = readResponse(incoming, { maxBytes, signal, check, createError }); reader.result.then(result => finish(null, result), error => finish(error)); }
        catch (error) { finish(error); }
      });
      outgoing.once('socket', socket => { const closed = Promise.withResolvers(); closes.push(closed.promise); socket.once('close', closed.resolve); });
      outgoing.on('error', () => finish(createError('unavailable')));
      outgoing.on('upgrade', (response, socket) => { response.destroy(); socket.destroy(); finish(createError('invalid')); });
      outgoing.once('close', () => { requestClosed.resolve(); if (!settled && !incoming) finish(createError('unavailable')); });
      if (signal.aborted) abort(); else outgoing.end(body);
    } catch (error) { finish(error); if (!outgoing) requestClosed.resolve(); }
    const drained = completion.promise.then(() => {}, () => {}).then(async () => {
      await requestClosed.promise;
      if (reader && await reader.drained !== true) return false;
      await Promise.all([...closes, ...dns]); signal.removeEventListener('abort', abort); return true;
    });
    return { result: completion.promise, drained };
  } };
}
