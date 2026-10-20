/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { openOwnedTcpServer } from './owned-tcp-server.js';
import { createPeerInput } from './peer-input.js';
import { wireReader, wireFrame, wireInteger, wireString } from './wire-codec.js';
import { nativeFiles, nativeTimeoutFile } from './fixture-data.js';
import { nativeTransferFiles } from './native-file-data.js';
import { sendNativeFile } from './native-file-sender.js';
import { nativePartialPlans } from './native-partial-plan.js';
import { sendNativePartial } from './native-partial-sender.js';

export async function openFixturePeer({ username, host, port, idleTimeout, mode, stats, refuse, beforeReset }) {
  const transferMode = ['files', 'partial'].includes(mode);
  const files = mode === 'partial' ? nativePartialPlans.map(plan => plan.file)
    : mode === 'files' ? nativeTransferFiles : mode === 'cancellation' ? [nativeTimeoutFile] : nativeFiles;
  const filenames = new Map(files.map(file => [file.filename, file]));
  const tokens = new Map(); const pending = new Set();
  const lifetime = new AbortController();
  let closing = false;
  const server = await openOwnedTcpServer({ host, port, idleTimeout, onDrop: refuse, onSocket(socket) {
    let messages = 0;
    const input = createPeerInput({ username,
      onInit(kind, token) {
        if (kind === 'P') { stats.peerConnections += 1; return; }
        if (!transferMode || !tokens.has(token) || tokens.get(token).claimed) throw new Error('Unowned transfer connection');
        tokens.get(token).claimed = true;
        stats.fileConnections += 1;
      },
      onMessage(payload) {
        if (++messages > 128) throw new RangeError('Fixture message bound exceeded');
        const reader = wireReader(payload);
        if (reader.integer() !== 40 || reader.integer() !== 0) throw new Error('Unexpected peer operation');
        const token = reader.integer(); const filename = reader.text();
        reader.integer(); reader.integer(); reader.end(); // TransferRequest's int64 size, unused for download.
        if (!filenames.has(filename) || (mode === 'cancellation' ? stats.requests.length >= 2
          : stats.requests.includes(filename) || stats.requests.length >= files.length)) throw new Error('Unexpected fixture file');
        stats.requests.push(filename);
        if (mode === 'cancellation' && stats.requests.length === 1) return;
        if (transferMode) {
          if (tokens.has(token)) throw new Error('Reused transfer token');
          const file = filenames.get(filename); tokens.set(token, { file, claimed: false });
          socket.write(wireFrame(41, wireInteger(token), Buffer.from([1]), wireInteger(file.size), wireInteger(0)));
        } else socket.write(wireFrame(41, wireInteger(token), Buffer.from([0]), wireString('Queued')));
      },
      onTransfer(token) {
        if (closing) return;
        const record = tokens.get(token);
        if (!record || record.sent) throw new Error('Replayed transfer negotiation');
        record.sent = true;
        const plan = mode === 'partial' ? nativePartialPlans.find(row => row.file === record.file) : null;
        const fault = plan && plan.kind !== 'complete';
        const task = fault ? sendNativePartial(socket, plan, { signal: lifetime.signal, beforeReset }) : sendNativeFile(socket, record.file);
        pending.add(task);
        task.then(result => { if (fault) stats.partialFiles.push(result); else stats.sentFiles.push(record.file.filename); },
          () => { if (!closing) refuse(); socket.destroy(); }).finally(() => pending.delete(task));
      },
    });
    socket.on('data', chunk => { try { input.push(chunk); } catch { refuse(); socket.destroy(); } });
    socket.on('end', () => { try { input.end(); } catch { refuse(); } });
  } });
  let closed;
  return { port: server.port, active: server.active,
    close() {
      closed ??= (async () => {
        closing = true;
        lifetime.abort();
        try { await server.close(); } finally { await Promise.allSettled([...pending]); }
      })();
      return closed;
    },
  };
}
