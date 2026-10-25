/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { artworkWorkerError, ARTWORK_WORKER_OUTPUT_LIMIT } from './artwork-worker-protocol.js';
import { webpEncoderGrowthMemoryBytes } from './artwork-webp-policy.js';
import { canReserveArtworkWebpSelection } from './artwork-webp-selection-policy.js';

export const ARTWORK_WORKER_DATA_LIMIT = 1024 * 1024 * 1024;
const sampleBytes = new Map([['uchar', 1], ['char', 1], ['ushort', 2], ['short', 2], ['uint', 4], ['int', 4], ['float', 4], ['double', 8]]);

/** DATA is an allocation limit, not an RSS limit or a complete native sandbox. */
export function artworkWorkerLaunch(workerPath, args, { platform = process.platform, execPath = process.execPath } = {}) {
  const nodeArgs = ['--jitless', '--max-old-space-size=128', workerPath, ...args];
  if (platform !== 'linux') return { command: execPath, args: nodeArgs };
  return { command: '/usr/bin/prlimit', args: [`--data=${ARTWORK_WORKER_DATA_LIMIT}:${ARTWORK_WORKER_DATA_LIMIT}`,
    '--core=0:0', '--', execPath, ...nodeArgs] };
}

/** Refuse a missing/unbounded Linux launcher before reading untrusted input. */
export async function assertArtworkWorkerMemoryLimit({ platform = process.platform, readFileFn = readFile } = {}) {
  if (platform !== 'linux') return;
  let limits;
  try { limits = await readFileFn('/proc/self/limits', 'utf8'); } catch { throw artworkWorkerError('memory'); }
  const match = /^Max data size\s+(\d+)\s+(\d+)\s+bytes\s*$/mu.exec(limits);
  if (!match || ![match[1], match[2]].every(value => Number(value) > 0 && Number(value) <= ARTWORK_WORKER_DATA_LIMIT)) {
    throw artworkWorkerError('memory');
  }
}

/** Conservative admission estimate; the kernel limit remains the allocation guard. */
export function artworkDecodedMemoryBytes(metadata, width = metadata.width, height = metadata.height) {
  const channels = Number.isInteger(metadata.channels) && metadata.channels >= 1 && metadata.channels <= 4 ? metadata.channels : 4;
  const bytes = sampleBytes.get(metadata.depth) ?? 8;
  return 4 * width * height * Math.max(3, channels) * bytes;
}
/** libvips WebP decoding uses an RGBA canvas even for an RGB result. */
export function artworkDecoderCanvasBytes(metadata, width = metadata.width, height = metadata.height) {
  return metadata.format === 'webp' ? 4 * width * height : 0;
}
/** Shared child estimate, including runtime and retained native rewrite output.
 * This is conservative admission accounting, not an allocator or RSS guarantee.
 */
export function artworkWorkerMemoryEstimate(metadata, inputBytes, width = metadata.width, height = metadata.height) {
  if (metadata.webpSelection !== undefined) {
    if (metadata.webpSelection !== true || !canReserveArtworkWebpSelection({ ...metadata, width, height }, inputBytes)) throw artworkWorkerError('memory');
    // Both retained outputs and the native working set stay inside this DATA
    // envelope. Do not infer a tighter bound from isolated encoder measurements.
    return ARTWORK_WORKER_DATA_LIMIT;
  }
  return 128 * 1024 ** 2 + 2 * inputBytes + ARTWORK_WORKER_OUTPUT_LIMIT
    + artworkDecodedMemoryBytes(metadata, width, height) + artworkDecoderCanvasBytes(metadata, width, height)
    + (metadata.format === 'webp' ? webpEncoderGrowthMemoryBytes(width, height) : 0);
}
export function assertArtworkMemoryAdmission({ metadata, width, height, inputBytes }) {
  const estimate = artworkWorkerMemoryEstimate(metadata, inputBytes, width, height);
  if (!Number.isSafeInteger(estimate) || estimate > ARTWORK_WORKER_DATA_LIMIT) throw artworkWorkerError('memory');
}
