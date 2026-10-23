/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { artworkWorkerError } from './artwork-worker-protocol.js';
import { ARTWORK_WORKER_GRANT, artworkWorkerMetadata } from './artwork-worker-session-protocol.js';

/** One bounded binary input, metadata, then exact parent grant plus EOF. */
export function createArtworkWorkerSession({ input = process.stdin, output = process.stdout, inputBytes, maxBytes }) {
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 1 || inputBytes > maxBytes) throw artworkWorkerError();
  const iterator = input[Symbol.asyncIterator](); let read = false; let ready = false; let requested = false;
  return { async readInput() {
    if (read) throw artworkWorkerError(); read = true;
    const buffer = Buffer.alloc(inputBytes); let offset = 0;
    while (offset < inputBytes) {
      const next = await iterator.next();
      if (next.done || next.value.length > inputBytes - offset) throw artworkWorkerError();
      next.value.copy(buffer, offset); offset += next.value.length;
    }
    ready = true; return buffer;
  }, async requestGrant(metadata) {
    if (!ready || requested) throw artworkWorkerError(); requested = true;
    output.write(`${JSON.stringify(artworkWorkerMetadata(metadata))}\n`);
    let grant = Buffer.alloc(0);
    for (;;) {
      const next = await iterator.next(); if (next.done) break;
      if (grant.length + next.value.length > ARTWORK_WORKER_GRANT.length) throw artworkWorkerError();
      grant = Buffer.concat([grant, next.value]);
    }
    if (!grant.equals(Buffer.from(ARTWORK_WORKER_GRANT, 'ascii'))) throw artworkWorkerError();
  } };
}
