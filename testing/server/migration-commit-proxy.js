/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';

/** One disposable loopback connection; cut either COMMIT dispatch or its real server reply. */
export async function createMigrationCommitProxy(mode) {
  assert.ok(['before-dispatch', 'after-commit'].includes(mode));
  const sockets = new Set(); let connections = 0, commitForwarded = false, commitObserved = false, cut = false, fault;
  const server = net.createServer(front => {
    connections++;
    const back = net.connect({ host: '127.0.0.1', port: 5432 });
    for (const socket of [front, back]) {
      sockets.add(socket);
      socket.on('error', error => { if (!cut) fault ??= error; front.destroy(); back.destroy(); });
      socket.on('close', () => { sockets.delete(socket); front.destroy(); back.destroy(); });
    }
    let startup = true, incoming = Buffer.alloc(0), outgoing = Buffer.alloc(0);
    const stop = () => { cut = true; front.destroy(); back.destroy(); };
    front.on('data', data => {
      incoming = Buffer.concat([incoming, data]);
      while (!cut && incoming.length >= (startup ? 4 : 5)) {
        const length = incoming.readInt32BE(startup ? 0 : 1) + (startup ? 0 : 1);
        if (length < (startup ? 8 : 5) || length > 2 * 1024 ** 2) { fault ??= new Error('Invalid fixture frontend frame'); stop(); break; }
        if (incoming.length < length) break;
        const frame = incoming.subarray(0, length); incoming = incoming.subarray(length);
        const commit = !startup && frame[0] === 81 && frame.subarray(5).toString('utf8') === 'COMMIT\0';
        startup = false;
        if (commit && mode === 'before-dispatch') { stop(); break; }
        if (commit) commitForwarded = true;
        back.write(frame);
      }
    });
    back.on('data', data => {
      outgoing = Buffer.concat([outgoing, data]);
      while (!cut && outgoing.length >= 5) {
        const length = outgoing.readInt32BE(1) + 1;
        if (length < 5 || length > 2 * 1024 ** 2) { fault ??= new Error('Invalid fixture backend frame'); stop(); break; }
        if (outgoing.length < length) break;
        const frame = outgoing.subarray(0, length); outgoing = outgoing.subarray(length);
        if (frame[0] === 67 && frame.subarray(5).toString('utf8') === 'COMMIT\0') {
          commitObserved = true; stop(); break;
        }
        front.write(frame);
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    port: server.address().port,
    facts() {
      if (fault) throw fault;
      assert.equal(connections, 1); assert.equal(cut, true);
      assert.equal(commitForwarded, mode === 'after-commit'); assert.equal(commitObserved, mode === 'after-commit');
      return { mode, connections, commitForwarded, serverCommitObserved: commitObserved, commitAcknowledgementForwarded: false };
    },
    async close() {
      await Promise.all([...sockets].map(async socket => {
        const closed = new Promise(resolve => { socket.once('close', resolve); });
        socket.destroy(); await closed;
      }));
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
      assert.equal(sockets.size, 0);
    },
  };
}
