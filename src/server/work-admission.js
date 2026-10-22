/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const ownedErrors = new WeakSet();
export function isWorkAdmissionError(error) { return ownedErrors.has(error); }

/** Instance-owned FIFO; a slot lasts until the original task actually settles. */
export function createWorkAdmission({ concurrency, maxQueued, queueTimeoutMs, makeError,
  maxQueuedWeight = Number.MAX_SAFE_INTEGER, now = () => performance.now() }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8
    || !Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > 256
    || !Number.isInteger(queueTimeoutMs) || queueTimeoutMs < 1 || queueTimeoutMs > 60_000
    || !Number.isSafeInteger(maxQueuedWeight) || maxQueuedWeight < 0 || typeof makeError !== 'function') {
    throw new TypeError('Invalid work admission policy');
  }
  const error = reason => { const value = makeError(reason); ownedErrors.add(value); return value; };
  let active = 0; let queuedWeight = 0;
  const queue = [];
  function detach(entry) { clearTimeout(entry.timer); entry.signal?.removeEventListener('abort', entry.abort); }
  function remove(entry, reason) {
    const index = queue.indexOf(entry);
    if (index < 0) return;
    queue.splice(index, 1); queuedWeight -= entry.weight; detach(entry); entry.reject(error(reason));
  }
  function start(entry) {
    detach(entry); active++;
    void (async () => {
      try { entry.resolve(await entry.task()); }
      catch (failure) { entry.reject(failure); }
      finally {
        active--;
        while (active < concurrency && queue.length) {
          const next = queue.shift(); queuedWeight -= next.weight; detach(next);
          if (next.signal?.aborted) next.reject(error('cancelled'));
          else if (now() >= next.expiresAt) next.reject(error('capacity'));
          else start(next);
        }
      }
    })();
  }
  function run(task, { signal, weight = 0 } = {}) {
    if (typeof task !== 'function' || (signal !== undefined && !(signal instanceof AbortSignal))
      || !Number.isSafeInteger(weight) || weight < 0) return Promise.reject(new TypeError('Invalid work admission request'));
    if (signal?.aborted) return Promise.reject(error('cancelled'));
    if (active >= concurrency && (queue.length >= maxQueued || weight > maxQueuedWeight - queuedWeight)) {
      return Promise.reject(error('capacity'));
    }
    return new Promise((resolve, reject) => {
      const entry = { task, signal, weight, resolve, reject };
      if (active < concurrency) { start(entry); return; }
      entry.expiresAt = now() + queueTimeoutMs;
      entry.abort = () => remove(entry, 'cancelled');
      entry.timer = setTimeout(() => remove(entry, 'capacity'), queueTimeoutMs);
      queue.push(entry); queuedWeight += weight;
      signal?.addEventListener('abort', entry.abort, { once: true });
      if (signal?.aborted) entry.abort();
    });
  }
  return { run, getState: () => ({ active, queued: queue.length, queuedWeight }) };
}
