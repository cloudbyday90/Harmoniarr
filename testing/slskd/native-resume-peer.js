/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { openOwnedTcpServer } from './owned-tcp-server.js';
import { createPeerInput } from './peer-input.js';
import { wireReader, wireFrame, wireInteger } from './wire-codec.js';
import { createNativeResumePolicy } from './native-resume-policy.js';
import { sendNativeResume } from './native-resume-transfer.js';

export async function openNativeResumePeer({ username, host, port, idleTimeout, stats, refuse, beforeReset }) {
  const policy = createNativeResumePolicy(); const pending = new Set(); const lifetime = new AbortController();
  let closing = false;
  const server = await openOwnedTcpServer({ host, port, idleTimeout, onDrop: refuse, onSocket(socket) {
    let messages = 0; let owned;
    socket.once('close', () => { if (owned) owned.closed = true; });
    const input = createPeerInput({ username,
      onInit(kind, token) {
        if (kind === 'P') { stats.peerConnections += 1; return; }
        owned = policy.claim(token); stats.fileConnections += 1;
      },
      onMessage(payload) {
        if (++messages > 128) throw new RangeError('Resume peer message bound exceeded');
        const reader = wireReader(payload);
        if (reader.integer() !== 40 || reader.integer() !== 0) throw new Error('Unexpected resume peer operation');
        const token = reader.integer(); const filename = reader.text();
        reader.integer(); reader.integer(); reader.end();
        const record = policy.reserve(token, filename);
        stats.requests.push(filename);
        socket.write(wireFrame(41, wireInteger(token), Buffer.from([1]), wireInteger(record.plan.file.size), wireInteger(0)));
      },
      acceptOffset: (token, offset) => policy.acceptOffset(token, offset),
      onTransfer(token, offset) {
        if (closing) return;
        const record = policy.start(token, offset);
        const task = sendNativeResume(socket, record, offset, { signal: lifetime.signal, beforeReset });
        pending.add(task);
        task.then(result => {
          record.sent = true;
          if (record.attempt === 1) stats.partialFiles.push(result);
          else { stats.resumeFiles.push(result); stats.sentFiles.push(record.plan.file.filename); }
        }, () => { if (!closing) refuse(); socket.destroy(); }).finally(() => pending.delete(task));
      },
    });
    socket.on('data', chunk => { try { input.push(chunk); } catch { refuse(); socket.destroy(); } });
    socket.on('end', () => { try { input.end(); } catch { refuse(); } });
  } });
  let closed;
  return { port: server.port, active: server.active,
    close() {
      closed ??= (async () => {
        closing = true; lifetime.abort();
        try { await server.close(); } finally { await Promise.allSettled([...pending]); }
      })();
      return closed;
    },
  };
}
