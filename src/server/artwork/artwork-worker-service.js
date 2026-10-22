/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { assertArtworkBuffer, artworkInputByteLimit, artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { artworkWorkerError, artworkWorkerRefusal, createArtworkWorkerCollector } from './artwork-worker-protocol.js';

const workerPath = fileURLToPath(new URL('./artwork-image-worker.js', import.meta.url));

export function createArtworkWorkerService({ spawnFn = spawn, timeoutMs = 15_000, now = () => performance.now() } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError('Invalid artwork worker deadline');
  async function processArtworkBuffer({ buffer, maxBytes, maxDimensionPixels, signal }) {
    assertArtworkBuffer(buffer);
    maxBytes = artworkInputByteLimit({ maxOriginalFileSizeBytes: maxBytes });
    maxDimensionPixels ??= 8192;
    artworkSharpInputOptions(maxDimensionPixels);
    if (buffer.length > maxBytes) throw artworkWorkerRefusal('artwork_file_too_large');
    if (signal?.aborted) throw artworkWorkerError('cancelled');
    const started = now();
    const collector = createArtworkWorkerCollector(maxDimensionPixels);
    let child;
    try {
      child = spawnFn(process.execPath, [workerPath, String(maxBytes), String(maxDimensionPixels)], {
        shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
          UV_THREADPOOL_SIZE: '1', VIPS_CONCURRENCY: '1', NODE_ENV: 'production' },
      });
    } catch { throw artworkWorkerError(); }
    return new Promise((resolve, reject) => {
      let failure; let closed = false;
      function refuse(error) {
        if (closed || failure) return;
        failure = error;
        child.stdin.destroy();
        // Never release on kill's return value. close is the retirement boundary.
        try { child.kill('SIGKILL'); } catch { /* Retain ownership until close even when kill fails. */ }
      }
      const abort = () => refuse(artworkWorkerError('cancelled'));
      const timer = setTimeout(() => refuse(artworkWorkerError('timeout')), timeoutMs);
      child.on('error', () => refuse(artworkWorkerError()));
      child.stdin.on('error', () => refuse(artworkWorkerError()));
      child.stdout.on('error', () => refuse(artworkWorkerError()));
      child.stdout.on('data', chunk => {
        if (failure) return;
        if (now() - started >= timeoutMs) { refuse(artworkWorkerError('timeout')); return; }
        try { collector.push(chunk); } catch { refuse(artworkWorkerError()); }
      });
      child.once('close', (code, exitSignal) => {
        closed = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (failure) { reject(failure); return; }
        if (signal?.aborted) { reject(artworkWorkerError('cancelled')); return; }
        if (now() - started >= timeoutMs) { reject(artworkWorkerError('timeout')); return; }
        if (exitSignal) { reject(artworkWorkerError()); return; }
        try { resolve(collector.result(code)); } catch (error) { reject(error); }
      });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      if (!failure) child.stdin.end(buffer);
    });
  }
  return { processArtworkBuffer };
}

export const processArtworkBuffer = createArtworkWorkerService().processArtworkBuffer;
