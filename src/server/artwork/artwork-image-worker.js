/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import sharp from 'sharp';
import { finished } from 'node:stream/promises';
import { transformArtworkBuffer } from './artwork-image-transform.js';
import { artworkInputByteLimit, artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { artworkWorkerRefusal, isArtworkWorkerError } from './artwork-worker-protocol.js';
import { assertArtworkWorkerMemoryLimit } from './artwork-worker-memory.js';

// No application environment, source path, URL, repository or publication authority.
sharp.cache(false);
sharp.concurrency(1);
try {
  await assertArtworkWorkerMemoryLimit();
  const maxBytes = Number(process.argv[2]); const maxDimensionPixels = Number(process.argv[3]);
  artworkInputByteLimit({ maxOriginalFileSizeBytes: maxBytes });
  artworkSharpInputOptions(maxDimensionPixels);
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > maxBytes) throw artworkWorkerRefusal('artwork_file_too_large');
    chunks.push(chunk);
  }
  const { data, ...projection } = await transformArtworkBuffer({ buffer: Buffer.concat(chunks, size), maxBytes, maxDimensionPixels });
  process.stdout.write(`${JSON.stringify({ ...projection, size: data.length })}\n`);
  process.stdout.end(data);
  await finished(process.stdout);
} catch (error) {
  const code = artworkWorkerRefusal(error?.code) ? error.code : 'artwork_image_invalid';
  process.exitCode = 1;
  const refusal = isArtworkWorkerError(error) ? { failure: error.code === 'artwork_worker_memory' ? 'memory' : 'failed' } : { error: code };
  process.stdout.end(`${JSON.stringify(refusal)}\n`);
  await finished(process.stdout).catch(() => {});
}
