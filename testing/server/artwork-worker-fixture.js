/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { finished } from 'node:stream/promises';
import sharp from 'sharp';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';

let size = 0; const chunks = [];
for await (const chunk of process.stdin) { size += chunk.length; chunks.push(chunk); }
if (process.argv[4] === 'native-active') {
  const timer = setInterval(() => {
    if (sharp.counters().process > 0) {
      clearInterval(timer);
      // A partial protocol prefix signals observed native work to the parent.
      process.stdout.write(' ');
    }
  }, 1);
}
const result = await transformArtworkBuffer({ buffer: Buffer.concat(chunks, size), maxBytes: Number(process.argv[2]), maxDimensionPixels: Number(process.argv[3]) });
const { data, ...projection } = result;
process.stdout.write(`${JSON.stringify({ ...projection, size: data.length })}\n`);
process.stdout.end(data);
await finished(process.stdout);
if (process.argv[4] === 'crash') process.exit(7);
// Deliberate synchronous non-cooperation after actual Sharp processing. This is
// a retirement control, not a reproduced libvips vulnerability.
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
