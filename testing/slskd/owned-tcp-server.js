/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createServer } from 'node:net';

/** Close admission, destroy owned sockets, and await their actual close events. */
export async function openOwnedTcpServer({ onSocket, host = '127.0.0.1', port = 0, onDrop = () => {}, idleTimeout = 30_000 }) {
  if (!Number.isSafeInteger(idleTimeout) || idleTimeout < 1 || idleTimeout > 240_000) throw new TypeError('Invalid owned socket idle bound');
  const sockets = new Map();
  let closing = null;
  const server = createServer(socket => {
    const closed = new Promise(resolve => { socket.once('close', resolve); });
    sockets.set(socket, closed);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', () => { /* Socket failures terminate this owned connection. */ });
    socket.setTimeout(idleTimeout, () => socket.destroy());
    try { onSocket(socket); } catch { socket.destroy(); }
  });
  server.maxConnections = 8;
  server.on('drop', onDrop);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  return {
    port: server.address().port,
    active: () => sockets.size,
    close() {
      closing ??= (async () => {
        const owned = [...sockets];
        const closed = new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
        for (const [socket] of owned) socket.destroy();
        await Promise.all([closed, ...owned.map(([, done]) => done)]);
      })();
      return closing;
    },
  };
}
