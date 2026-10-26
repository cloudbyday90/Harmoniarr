/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';

/** Cut a real successful advisory-lock reply before delivering its boolean row. */
export async function createPreparationLockProxy(mode) {
  assert.ok(['acquire', 'unlock'].includes(mode));
  const needle = mode === 'acquire' ? 'pg_catalog.pg_try_advisory_lock(' : 'pg_catalog.pg_advisory_unlock(';
  const sockets = new Set(); let connections = 0, cut = false, observedTrue = false, fault;
  const server = net.createServer(front => {
    connections++; const back = net.connect({ host: '127.0.0.1', port: 5432 });
    const stop = () => { cut = true; front.destroy(); back.destroy(); };
    for (const socket of [front, back]) {
      sockets.add(socket);
      socket.on('error', error => { if (!cut) fault ??= error; front.destroy(); back.destroy(); });
      socket.on('close', () => { sockets.delete(socket); front.destroy(); back.destroy(); });
    }
    let startup = true, incoming = Buffer.alloc(0), outgoing = Buffer.alloc(0), selected = false;
    front.on('data', data => {
      incoming = Buffer.concat([incoming, data]);
      while (!cut && incoming.length >= (startup ? 4 : 5)) {
        const length = incoming.readInt32BE(startup ? 0 : 1) + (startup ? 0 : 1);
        if (length < (startup ? 8 : 5) || length > 2 * 1024 ** 2) { fault ??= new Error('Invalid fixture frontend frame'); stop(); break; }
        if (incoming.length < length) break;
        const frame = incoming.subarray(0, length); incoming = incoming.subarray(length);
        if (!startup && frame[0] === 80) {
          const nameEnd = frame.indexOf(0, 5), sqlEnd = frame.indexOf(0, nameEnd + 1);
          if (nameEnd < 5 || sqlEnd < nameEnd + 1) { fault ??= new Error('Invalid fixture parse frame'); stop(); break; }
          selected = frame.subarray(nameEnd + 1, sqlEnd).toString('utf8').includes(needle);
        }
        startup = false; back.write(frame);
      }
    });
    back.on('data', data => {
      outgoing = Buffer.concat([outgoing, data]);
      while (!cut && outgoing.length >= 5) {
        const length = outgoing.readInt32BE(1) + 1;
        if (length < 5 || length > 2 * 1024 ** 2) { fault ??= new Error('Invalid fixture backend frame'); stop(); break; }
        if (outgoing.length < length) break;
        const frame = outgoing.subarray(0, length); outgoing = outgoing.subarray(length);
        if (selected && frame[0] === 68) {
          if (frame.length !== 12 || frame.readInt16BE(5) !== 1 || frame.readInt32BE(7) !== 1 || frame[11] !== 116) {
            fault ??= new Error('Fixture expected a successful boolean reply'); stop(); break;
          }
          observedTrue = true; stop(); break;
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
      assert.equal(connections, 1); assert.equal(cut, true); assert.equal(observedTrue, true);
      return { mode, connections, actualServerTrue: observedTrue, replyForwarded: false };
    },
    async close() {
      await Promise.all([...sockets].map(async socket => {
        const closed = new Promise(resolve => { socket.once('close', resolve); }); socket.destroy(); await closed;
      }));
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
      assert.equal(sockets.size, 0);
    },
  };
}
