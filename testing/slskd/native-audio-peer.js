/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { openOwnedTcpServer } from './owned-tcp-server.js';
import { createPeerInput } from './peer-input.js';
import { wireReader, wireFrame, wireInteger } from './wire-codec.js';
import { nativeAudioFiles, nativeAudioChunk } from './native-audio-data.js';

export async function openNativeAudioPeer({ username, host, port, idleTimeout, stats, refuse }) {
  const tokens = new Map(); const pending = new Set(); let closing = false;
  const server = await openOwnedTcpServer({ host, port, idleTimeout, onDrop: refuse, onSocket(socket) {
    const input = createPeerInput({ username,
      onInit(kind, token) {
        if (kind === 'P') { stats.peerConnections += 1; return; }
        const record = tokens.get(token);
        if (!record || record.claimed) throw new Error('Unowned audio capability');
        record.claimed = true; stats.fileConnections += 1;
      },
      onMessage(payload) {
        const reader = wireReader(payload);
        if (reader.integer() !== 40 || reader.integer() !== 0) throw new Error('Unexpected audio peer request');
        const token = reader.integer(); const filename = reader.text(); reader.integer(); reader.integer(); reader.end();
        const file = nativeAudioFiles.find(row => row.filename === filename);
        if (!file || tokens.has(token) || stats.requests.includes(filename) || stats.requests.length >= 2) throw new Error('Unowned or duplicate audio request');
        stats.requests.push(filename); tokens.set(token, { file, claimed: false, sent: false });
        socket.write(wireFrame(41, wireInteger(token), Buffer.from([1]), wireInteger(file.size), wireInteger(0)));
      },
      onTransfer(token) {
        if (closing) return;
        const record = tokens.get(token);
        if (!record || record.sent) throw new Error('Replayed audio capability');
        record.sent = true;
        function* chunks() {
          for (let offset = 0; offset < record.file.size; offset += 16384) yield nativeAudioChunk(record.file, offset, Math.min(16384, record.file.size - offset));
        }
        const task = pipeline(Readable.from(chunks(), { objectMode: false, highWaterMark: 16384 }), socket, { end: false });
        pending.add(task);
        task.then(() => stats.sentFiles.push(record.file.filename), () => { if (!closing) refuse(); socket.destroy(); }).finally(() => pending.delete(task));
      },
    });
    socket.on('data', chunk => { try { input.push(chunk); } catch { refuse(); socket.destroy(); } });
    socket.on('end', () => { try { input.end(); } catch { refuse(); } });
  } });
  let closed;
  return { port: server.port, active: server.active, close() {
    closed ??= (async () => { closing = true; try { await server.close(); } finally { await Promise.allSettled([...pending]); } })();
    return closed;
  } };
}
