/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { assertArtworkBuffer, artworkInputByteLimit, artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { artworkWorkerError, artworkWorkerRefusal, isArtworkWorkerError } from './artwork-worker-protocol.js';
import { artworkWorkerLaunch } from './artwork-worker-memory.js';
import { createArtworkSessionCollector, ARTWORK_WORKER_GRANT } from './artwork-worker-session-protocol.js';
import { canReserveArtworkWebpSelection } from './artwork-webp-selection-policy.js';

const workerPath = fileURLToPath(new URL('./artwork-image-worker.js', import.meta.url));

export function createArtworkWorkerService({ spawnFn = spawn, timeoutMs = 15_000, now = () => performance.now() } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new TypeError('Invalid artwork worker deadline');
  async function processArtworkBuffer({ buffer, maxBytes, maxDimensionPixels, signal, onMetadata }) {
    assertArtworkBuffer(buffer);
    maxBytes = artworkInputByteLimit({ maxOriginalFileSizeBytes: maxBytes });
    maxDimensionPixels ??= 8192;
    artworkSharpInputOptions(maxDimensionPixels);
    if (onMetadata !== undefined && typeof onMetadata !== 'function') throw new TypeError('Invalid artwork metadata owner');
    if (buffer.length > maxBytes) throw artworkWorkerRefusal('artwork_file_too_large');
    if (signal?.aborted) throw artworkWorkerError('cancelled');
    const started = now();
    let child;
    try {
      const launch = artworkWorkerLaunch(workerPath, [String(maxBytes), String(maxDimensionPixels), String(buffer.length)]);
      child = spawnFn(launch.command, launch.args, {
        shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
          UV_THREADPOOL_SIZE: '1', VIPS_CONCURRENCY: '1', NODE_ENV: 'production' },
      });
    } catch { throw artworkWorkerError(); }
    return new Promise((resolve, reject) => {
      let failure; let closed = false;
      const collector = createArtworkSessionCollector(maxDimensionPixels, metadata => {
        if (metadata.webpSelection === true && !canReserveArtworkWebpSelection(metadata, buffer.length)) throw artworkWorkerError();
        const ownerResult = onMetadata?.(metadata);
        if (ownerResult !== undefined) {
          if (ownerResult instanceof Promise) void ownerResult.catch(() => {});
          throw artworkWorkerError();
        }
        if (failure || signal?.aborted) throw artworkWorkerError('cancelled');
        if (now() - started >= timeoutMs) throw artworkWorkerError('timeout');
        child.stdin.end(ARTWORK_WORKER_GRANT);
      });
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
        try { collector.push(chunk); } catch (error) { refuse(isArtworkWorkerError(error) ? error : artworkWorkerError()); }
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
      if (!failure) child.stdin.write(buffer);
    });
  }
  return { processArtworkBuffer };
}

export const processArtworkBuffer = createArtworkWorkerService().processArtworkBuffer;
