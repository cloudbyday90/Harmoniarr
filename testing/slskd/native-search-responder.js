/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createConnection, isIPv4 } from 'node:net';
import { encodeNativeSearchResponse, nativeSearchPeers, resolveNativeSearchPlan } from './native-search-codec.js';

export function createNativeSearchResponder({ stats, refuse }) {
  const queries = new Set(); const tokens = new Set(); const pending = new Set(); const sockets = new Set();
  const lifetime = new AbortController(); let closing = false; let closed;
  async function send(host, port, response) {
    await new Promise((resolve, reject) => {
      const socket = createConnection({ host, port, signal: lifetime.signal });
      sockets.add(socket);
      let failure; let failed = false; let written = false;
      socket.setTimeout(3000, () => socket.destroy(new Error('Native search socket timed out')));
      socket.once('error', error => { failed = true; failure = error; });
      socket.on('data', () => socket.destroy(new Error('Unexpected native search return traffic')));
      socket.once('connect', () => socket.end(response.bytes, () => { written = true; }));
      socket.once('close', () => {
        sockets.delete(socket);
        if (failed) reject(failure);
        else if (!written) reject(new Error('Native search delivery closed before write completion'));
        else resolve();
      });
    });
  }
  return {
    active: () => sockets.size,
    dispatch({ socket, port, token, query }) {
      const plan = resolveNativeSearchPlan(query);
      if (closing) throw new Error('Native search admission closed');
      if (!isIPv4(socket.remoteAddress)) throw new Error('Unowned native search address');
      if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Missing native search endpoint');
      if (!Number.isSafeInteger(token) || token < 0 || token > 0x7fffffff) throw new Error('Invalid native search token');
      if (queries.has(query) || tokens.has(token) || queries.size >= 2) throw new Error('Repeated native search authority');
      // The endpoint comes only from this authenticated central connection.
      queries.add(query); tokens.add(token); stats.searchRequests.push({ token, query });
      const task = (async () => {
        for (const peer of nativeSearchPeers) {
          if (closing) return;
          const response = encodeNativeSearchResponse({ plan, peer, token });
          await send(socket.remoteAddress, port, response);
          stats.searchResponses.push(response.evidence);
        }
      })();
      pending.add(task);
      void task.then(() => {}, error => { if (!closing) { refuse(error); socket.destroy(); } }).finally(() => pending.delete(task));
      return task;
    },
    close() {
      closed ??= (async () => {
        closing = true; lifetime.abort();
        for (const socket of sockets) socket.destroy();
        await Promise.allSettled([...pending]);
      })();
      return closed;
    },
  };
}
