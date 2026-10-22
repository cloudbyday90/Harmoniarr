/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export const ARTWORK_FETCH_CONCURRENCY = 2;
export const ARTWORK_FETCH_BATCH_LIMIT = 50;
const ownedErrors = new WeakSet();

function admissionError(code) {
  const error = Object.assign(new Error(code === 'artwork_fetch_cancelled'
    ? 'Artwork request was cancelled before admission' : 'Artwork capacity is temporarily unavailable'), { code, status: 503 });
  ownedErrors.add(error);
  return error;
}

export function isArtworkAdmissionError(error) { return ownedErrors.has(error); }

/** Instance-owned FIFO admission. Active work owns its slot until actual settlement. */
export function createArtworkFetchAdmission({ concurrency = ARTWORK_FETCH_CONCURRENCY, maxQueued = 32,
  queueTimeoutMs = 15_000, now = () => performance.now() } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8
    || !Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > 256
    || !Number.isInteger(queueTimeoutMs) || queueTimeoutMs < 1 || queueTimeoutMs > 60_000) {
    throw new TypeError('Invalid artwork admission policy');
  }
  let active = 0;
  const queue = [];
  function detach(entry) {
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener('abort', entry.abort);
  }
  function remove(entry, code) {
    const index = queue.indexOf(entry);
    if (index < 0) return;
    queue.splice(index, 1); detach(entry); entry.reject(admissionError(code));
  }
  function start(entry) {
    detach(entry); active++;
    void (async () => {
      try { entry.resolve(await entry.task()); }
      catch (error) { entry.reject(error); }
      finally {
        active--;
        while (active < concurrency && queue.length) {
          const next = queue.shift();
          detach(next);
          if (next.signal?.aborted) next.reject(admissionError('artwork_fetch_cancelled'));
          else if (now() >= next.expiresAt) next.reject(admissionError('artwork_fetch_capacity'));
          else start(next);
        }
      }
    })();
  }
  function run(task, { signal } = {}) {
    if (typeof task !== 'function' || (signal !== undefined && !(signal instanceof AbortSignal))) {
      return Promise.reject(new TypeError('Invalid artwork admission request'));
    }
    if (signal?.aborted) return Promise.reject(admissionError('artwork_fetch_cancelled'));
    if (active >= concurrency && queue.length >= maxQueued) return Promise.reject(admissionError('artwork_fetch_capacity'));
    return new Promise((resolve, reject) => {
      const entry = { task, signal, resolve, reject };
      if (active < concurrency) { start(entry); return; }
      entry.expiresAt = now() + queueTimeoutMs;
      entry.abort = () => remove(entry, 'artwork_fetch_cancelled');
      entry.timer = setTimeout(() => remove(entry, 'artwork_fetch_capacity'), queueTimeoutMs);
      queue.push(entry);
      signal?.addEventListener('abort', entry.abort, { once: true });
      if (signal?.aborted) entry.abort();
    });
  }
  return { run, getState: () => ({ active, queued: queue.length }) };
}
