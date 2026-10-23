/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { finished } from 'node:stream/promises';
import sharp from 'sharp';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';
import { createArtworkWorkerSession } from '../../src/server/artwork/artwork-worker-session.js';

const session = createArtworkWorkerSession({ inputBytes: Number(process.argv[4]), maxBytes: Number(process.argv[2]) });
const buffer = await session.readInput();
async function onMetadata(metadata) {
  await session.requestGrant(metadata);
  if (process.argv[5] !== 'native-active') return;
  const timer = setInterval(() => {
    if (sharp.counters().process > 0) {
      clearInterval(timer);
      // A partial protocol prefix signals observed native work to the parent.
      process.stdout.write(' ');
    }
  }, 1);
}
const result = await transformArtworkBuffer({ buffer, maxBytes: Number(process.argv[2]), maxDimensionPixels: Number(process.argv[3]), onMetadata });
const { data, ...projection } = result;
process.stdout.write(`${JSON.stringify({ ...projection, size: data.length })}\n`);
process.stdout.end(data);
await finished(process.stdout);
if (process.argv[5] === 'crash') process.exit(7);
// Deliberate synchronous non-cooperation after actual Sharp processing. This is
// a retirement control, not a reproduced libvips vulnerability.
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
