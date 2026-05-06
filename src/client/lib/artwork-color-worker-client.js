/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * artwork-color-worker-client.js — Singleton client for the color extraction worker.
 *
 * Manages a single Web Worker instance shared across the application. Queues
 * extraction jobs and enforces a concurrency limit and per-job timeout.
 *
 * Usage:
 *   import { extractDominantColor } from './artwork-color-worker-client.js';
 *   const result = await extractDominantColor(imgElement);
 *   // result: { hue, chroma, lightness } | { hue: null, chroma: null, lightness: null }
 */

const MAX_CONCURRENT = 4;
const JOB_TIMEOUT_MS = 4000;

let worker = null;
let jobIdCounter = 0;
let activeCount = 0;
const queue = [];
const pending = new Map(); // jobId → { resolve, timeoutHandle }

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/color-worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (event) => {
      const { id, hue, chroma, lightness } = event.data;
      const job = pending.get(id);
      if (!job) return;

      clearTimeout(job.timeoutHandle);
      pending.delete(id);
      activeCount--;
      job.resolve({ hue, chroma, lightness });
      drainQueue();
    };

    worker.onerror = () => {
      // Worker crashed — drain all pending with null results, reset worker.
      const jobs = [...pending.values()];
      pending.clear();
      activeCount = 0;
      worker = null;

      for (const job of jobs) {
        clearTimeout(job.timeoutHandle);
        job.resolve({ hue: null, chroma: null, lightness: null });
      }

      drainQueue();
    };
  }

  return worker;
}

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const { id, bitmap, resolve } = queue.shift();
    activeCount++;

    const timeoutHandle = setTimeout(() => {
      pending.delete(id);
      activeCount--;
      resolve({ hue: null, chroma: null, lightness: null });
      drainQueue();
    }, JOB_TIMEOUT_MS);

    pending.set(id, { resolve, timeoutHandle });
    getWorker().postMessage({ id, bitmap }, [bitmap]);
  }
}

/**
 * Extract the dominant OKLCH color from an image element.
 *
 * Creates a 16×16 ImageBitmap from the element (hardware-accelerated downscale)
 * and sends it to the shared color worker for analysis.
 *
 * Returns a Promise that resolves to { hue, chroma, lightness } where any field
 * may be null (achromatic image, worker error, unsupported browser).
 *
 * @param {HTMLImageElement} imgEl
 * @returns {Promise<{ hue: number|null, chroma: number|null, lightness: number|null }>}
 */
export async function extractDominantColor(imgEl) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(imgEl, {
      resizeWidth: 16,
      resizeHeight: 16,
      resizeQuality: 'pixelated',
    });
  } catch {
    return { hue: null, chroma: null, lightness: null };
  }

  const id = ++jobIdCounter;

  return new Promise((resolve) => {
    queue.push({ id, bitmap, resolve });
    drainQueue();
  });
}
