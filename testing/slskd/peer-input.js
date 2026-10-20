/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createWireDecoder, wireReader } from './wire-codec.js';

/** One bounded framed initialization, then either framed messages or 12 raw negotiation bytes. */
export function createPeerInput({ username, onInit, onMessage, onTransfer, acceptOffset = (_token, offset) => offset === 0n }) {
  const header = Buffer.alloc(4); const raw = Buffer.alloc(12);
  let headerBytes = 0; let init = null; let initBytes = 0; let kind = null; let token; let rawBytes = 0; let failed = false;
  const messages = createWireDecoder(onMessage);
  return {
    push(chunk) {
      if (failed || !Buffer.isBuffer(chunk)) throw new TypeError('Invalid peer input');
      try {
        let offset = 0;
        if (!kind) {
          const head = Math.min(4 - headerBytes, chunk.length);
          chunk.copy(header, headerBytes, 0, head); headerBytes += head; offset += head;
          if (headerBytes < 4) return;
          if (!init) {
            const size = header.readUInt32LE();
            if (size < 1 || size > 16_384) throw new RangeError('Invalid peer initialization length');
            init = Buffer.allocUnsafe(size);
          }
          const count = Math.min(init.length - initBytes, chunk.length - offset);
          chunk.copy(init, initBytes, offset, offset + count); initBytes += count; offset += count;
          if (initBytes < init.length) return;
          const reader = wireReader(init);
          if (reader.byte() !== 1 || reader.text() !== username) throw new Error('Unexpected peer initialization');
          kind = reader.text(); token = reader.integer(); reader.end();
          if (!['P', 'F'].includes(kind)) throw new Error('Unexpected connection type');
          onInit(kind, token); init = null;
        }
        const rest = chunk.subarray(offset);
        if (kind === 'P') { messages.push(rest); return; }
        if (rawBytes + rest.length > raw.length) throw new RangeError('Extra transfer negotiation bytes');
        rest.copy(raw, rawBytes); rawBytes += rest.length;
        if (rawBytes === raw.length && rest.length > 0) {
          const resumeOffset = raw.readBigUInt64LE(4);
          if (raw.readUInt32LE() !== token || resumeOffset > BigInt(Number.MAX_SAFE_INTEGER)
            || acceptOffset(token, resumeOffset) !== true) throw new Error('Invalid transfer token or offset');
          onTransfer(token, Number(resumeOffset));
        }
      } catch (error) { failed = true; throw error; }
    },
    end() {
      if (!kind || (kind === 'F' && rawBytes !== raw.length)) throw new RangeError('Incomplete peer negotiation');
      if (kind === 'P') messages.end();
    },
  };
}
