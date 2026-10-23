/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { artworkWorkerError, ARTWORK_WORKER_HEADER_LIMIT, createArtworkWorkerCollector } from './artwork-worker-protocol.js';

const depths = ['uchar', 'char', 'ushort', 'short', 'uint', 'int', 'float', 'double', 'unknown'];
export const ARTWORK_WORKER_GRANT = 'grant\n';
export function artworkWorkerMetadata(metadata) {
  return { stage: 'metadata', format: metadata.format, width: metadata.width, height: metadata.height,
    channels: Number.isInteger(metadata.channels) && metadata.channels >= 1 && metadata.channels <= 4 ? metadata.channels : 4,
    depth: depths.includes(metadata.depth) ? metadata.depth : 'unknown' };
}

export function createArtworkSessionCollector(maxDimensionPixels, onMetadata) {
  const result = createArtworkWorkerCollector(maxDimensionPixels);
  let prefix = Buffer.alloc(0); let phase = 'metadata'; let metadata;
  return { push(chunk) {
    if (phase === 'result') { result.push(chunk); return; }
    const end = chunk.indexOf(10); const part = end === -1 ? chunk : chunk.subarray(0, end);
    if (prefix.length + part.length > ARTWORK_WORKER_HEADER_LIMIT) throw artworkWorkerError();
    prefix = Buffer.concat([prefix, part]); if (end === -1) return;
    let header;
    try { header = JSON.parse(prefix.toString('utf8')); } catch { throw artworkWorkerError(); }
    if (header?.error || header?.failure) {
      phase = 'result'; result.push(Buffer.concat([prefix, chunk.subarray(end)])); return;
    }
    if (!header || typeof header !== 'object' || Array.isArray(header) || header.stage !== 'metadata'
      || Object.keys(header).sort().join(',') !== 'channels,depth,format,height,stage,width'
      || !['jpeg', 'png', 'webp'].includes(header.format) || !depths.includes(header.depth)
      || !Number.isInteger(header.channels) || header.channels < 1 || header.channels > 4
      || !['width', 'height'].every(key => Number.isInteger(header[key]) && header[key] > 0 && header[key] <= maxDimensionPixels)
      || chunk.length !== end + 1) throw artworkWorkerError();
    metadata = header; phase = 'result'; prefix = null; onMetadata(header);
  }, result(code) {
    const value = result.result(code);
    if (!metadata || value.width !== metadata.width || value.height !== metadata.height || value.format !== metadata.format) throw artworkWorkerError();
    return value;
  } };
}
