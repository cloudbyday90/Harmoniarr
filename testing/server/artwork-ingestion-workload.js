/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

/** Fixed native work; sampled RSS is an observation, never a memory ceiling. */
export async function measureArtworkIngestionWorkload({ createArtworkIngestionService, inspectArtworkBuffer }) {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-artwork-workload-'));
  const tasks = []; let timer; let failed = false; let failure; let result;
  let active = 0; let peakActive = 0; let inspections = 0; let writes = 0; let peakRss = process.memoryUsage().rss;
  try {
    const dimension = 1024; const raw = Buffer.alloc(dimension * dimension * 3); let seed = 0x12345678;
    for (let i = 0; i < raw.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; raw[i] = seed & 255; }
    const input = await sharp(raw, { raw: { width: dimension, height: dimension, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const source = join(root, 'source.png'); await writeFile(source, input);
    const projection = [];
    const artworkPolicyService = { getArtworkRuntimePolicy: async () => ({
      limits: { maxOriginalFileSizeBytes: 20 * 1024 * 1024, maxOriginalDimensionPixels: dimension }, storage: { root },
    }) };
    const service = createArtworkIngestionService({ artworkPolicyService,
      inspectArtworkBufferFn: async (...args) => { active++; peakActive = Math.max(peakActive, active); inspections++; return inspectArtworkBuffer(...args); },
      getArtworkAssetBySha256Fn: async () => null,
      upsertArtworkAssetFn: async asset => {
        writes++; active--; projection.push({ sha256: asset.sha256, payloadChecksum: asset.payloadChecksum, fileSizeBytes: asset.fileSizeBytes,
          width: asset.width, height: asset.height, mimeType: asset.mimeType });
        return { ...asset, id: `asset-${writes}` };
      },
    });
    const sample = () => { peakRss = Math.max(peakRss, process.memoryUsage().rss); };
    sample(); timer = setInterval(sample, 5); const started = performance.now();
    for (let i = 0; i < 6; i++) tasks.push(i % 2
      ? service.ingestArtworkBuffer({ buffer: input, sourceProvider: 'embedded' })
      : service.ingestArtworkFile({ filePath: source, sourceProvider: 'sidecar' }));
    const results = await Promise.all(tasks); const elapsedMs = performance.now() - started; sample();
    assert.equal(inspections, 6); assert.equal(writes, 6); assert.equal(active, 0);
    assert.equal(new Set(projection.map(row => JSON.stringify(row))).size, 1);
    for (const row of results) {
      const bytes = await readFile(row.absolutePath);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), row.asset.sha256);
      const metadata = await sharp(bytes).metadata(); assert.equal(metadata.width, dimension); assert.equal(metadata.height, dimension);
    }
    result = { dimension, tasks: 6, fileInputs: 3, bufferInputs: 3, inputBytes: input.length, inspections, writes, peakActive,
      elapsedMs, sampledPeakRssBytes: peakRss, projection: projection[0], node: process.versions.node, sharp: sharp.versions.sharp, vips: sharp.versions.vips };
  } catch (error) { failed = true; failure = error; }
  finally {
    clearInterval(timer); await Promise.allSettled(tasks);
    try { await rm(root, { recursive: true, force: true }); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
  return result;
}
