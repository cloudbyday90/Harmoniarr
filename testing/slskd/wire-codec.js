/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const maxFrameBytes = 16 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });

export function wireInteger(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

export function wireString(value) {
  if (typeof value !== 'string') throw new TypeError('Expected fixture text');
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 4096) throw new RangeError('Fixture text exceeds its bound');
  return Buffer.concat([wireInteger(bytes.length), bytes]);
}

export function wireFrame(code, ...parts) {
  const body = Buffer.concat([wireInteger(code), ...parts]);
  if (body.length > maxFrameBytes) throw new RangeError('Fixture frame exceeds its bound');
  return Buffer.concat([wireInteger(body.length), body]);
}

export function wireReader(bytes) {
  let offset = 0;
  function take(size) {
    if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.length) throw new RangeError('Truncated fixture message');
    const result = bytes.subarray(offset, offset + size);
    offset += size;
    return result;
  }
  return {
    integer: () => take(4).readUInt32LE(),
    byte: () => take(1)[0],
    text() {
      const size = take(4).readUInt32LE();
      if (size > 4096) throw new RangeError('Fixture text exceeds its bound');
      return utf8.decode(take(size));
    },
    end() { if (offset !== bytes.length) throw new RangeError('Unexpected fixture message suffix'); },
  };
}

/** Allocate only a bounded declared payload; never expose incomplete bytes. */
export function createWireDecoder(onFrame) {
  if (typeof onFrame !== 'function') throw new TypeError('A frame consumer is required');
  const header = Buffer.alloc(4);
  let headBytes = 0;
  let payload = null;
  let payloadBytes = 0;
  let failed = false;
  return {
    push(chunk) {
      if (failed || !Buffer.isBuffer(chunk)) throw new TypeError('Invalid fixture frame stream');
      try {
        let offset = 0;
        while (offset < chunk.length) {
          if (!payload) {
            const count = Math.min(4 - headBytes, chunk.length - offset);
            chunk.copy(header, headBytes, offset, offset + count);
            headBytes += count; offset += count;
            if (headBytes !== 4) continue;
            const size = header.readUInt32LE();
            if (size < 1 || size > maxFrameBytes) throw new RangeError('Invalid fixture frame length');
            payload = Buffer.allocUnsafe(size); payloadBytes = 0;
          }
          const count = Math.min(payload.length - payloadBytes, chunk.length - offset);
          chunk.copy(payload, payloadBytes, offset, offset + count);
          payloadBytes += count; offset += count;
          if (payloadBytes === payload.length) {
            const complete = payload;
            payload = null; headBytes = 0; payloadBytes = 0;
            onFrame(complete);
          }
        }
      } catch (error) { failed = true; payload = null; throw error; }
    },
    end() { if (headBytes || payload) throw new RangeError('Incomplete fixture frame'); },
  };
}
