/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { performance } from 'node:perf_hooks';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { resolveOperatorTrackReadBuffer } from '../../src/server/metadata/operator-track-fingerprint-policy.js';

const [filePath, libraryRoot, bufferArgument] = process.argv.slice(2);
const readBufferBytes = resolveOperatorTrackReadBuffer(Number(bufferArgument));
if (!filePath || !libraryRoot || typeof global.gc !== 'function') throw new Error('Invalid fingerprint probe invocation');
global.gc();
const fields = ['rss', 'heapUsed', 'external', 'arrayBuffers'];
const baseline = process.memoryUsage(); const peak = Object.fromEntries(fields.map(field => [field, baseline[field]]));
let memorySamples = 0; let chunks = 0; let hashedBytes = 0; let sinceSample = 0; let evidence;
function sample() { const usage = process.memoryUsage(); memorySamples++; for (const field of fields) peak[field] = Math.max(peak[field], usage[field]); }
const timer = setInterval(sample, 5); timer.unref(); const started = performance.now();
try {
  for (let pass = 0; pass < 4; pass++) {
    const current = await fingerprintOperatorTrackFile(filePath, { libraryRoot, readBufferBytes, onBytesRead: amount => {
      chunks++; hashedBytes += amount; sinceSample += amount;
      if (chunks === 1 || sinceSample >= 1024 * 1024) { sample(); sinceSample = 0; }
    } });
    if (evidence && (evidence.sha256 !== current.sha256 || evidence.sizeBytes !== current.sizeBytes)) throw new Error('Controlled media changed');
    evidence = current;
  }
} finally { clearInterval(timer); sample(); }
const elapsedMs = performance.now() - started;
process.stdout.write(JSON.stringify({ evidence, readBufferBytes, passes: 4, chunks, hashedBytes, elapsedMs, memorySamples,
  baseline: Object.fromEntries(fields.map(field => [field, baseline[field]])), peak,
  peakDelta: Object.fromEntries(fields.map(field => [field, Math.max(0, peak[field] - baseline[field])])) }));
