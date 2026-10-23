/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const ownedErrors = new WeakSet();
export function isWorkAdmissionError(error) { return ownedErrors.has(error); }

/** Instance-owned FIFO; a slot lasts until the original task actually settles. */
export function createWorkAdmission({ concurrency, maxQueued, queueTimeoutMs, makeError,
  maxQueuedWeight = Number.MAX_SAFE_INTEGER, maxActiveWeight, now = () => performance.now() }) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8
    || !Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > 256
    || !Number.isInteger(queueTimeoutMs) || queueTimeoutMs < 1 || queueTimeoutMs > 60_000
    || !Number.isSafeInteger(maxQueuedWeight) || maxQueuedWeight < 0 || typeof makeError !== 'function'
    || (maxActiveWeight !== undefined && (!Number.isSafeInteger(maxActiveWeight) || maxActiveWeight < 1))) {
    throw new TypeError('Invalid work admission policy');
  }
  const error = reason => { const value = makeError(reason); ownedErrors.add(value); return value; };
  let active = 0; let queuedWeight = 0; let activeWeight = 0;
  const activeLimit = maxActiveWeight ?? Number.MAX_SAFE_INTEGER;
  const queue = [];
  function detach(entry) { clearTimeout(entry.timer); entry.signal?.removeEventListener('abort', entry.abort); }
  function remove(entry, reason) {
    const index = queue.indexOf(entry);
    if (index < 0) return;
    queue.splice(index, 1); queuedWeight -= entry.weight; detach(entry); entry.reject(error(reason)); pump();
  }
  function start(entry) {
    detach(entry); active++; activeWeight += entry.activeWeight; entry.live = true;
    const reservation = Object.freeze({ shrinkTo(next) {
      if (!entry.live || !Number.isSafeInteger(next) || next < 0 || next > entry.activeWeight) throw new TypeError('Invalid active reservation reduction');
      activeWeight -= entry.activeWeight - next; entry.activeWeight = next; pump();
    } });
    void (async () => {
      try { entry.resolve(await (maxActiveWeight === undefined ? entry.task() : entry.task(reservation))); }
      catch (failure) { entry.reject(failure); }
      finally {
        entry.live = false; active--; activeWeight -= entry.activeWeight; pump();
      }
    })();
  }
  function pump() {
    while (active < concurrency && queue.length) {
      const next = queue[0];
      if (next.signal?.aborted) { remove(next, 'cancelled'); continue; }
      if (now() >= next.expiresAt) { remove(next, 'capacity'); continue; }
      if (next.activeWeight > activeLimit - activeWeight) return;
      queue.shift(); queuedWeight -= next.weight; start(next);
    }
  }
  function run(task, { signal, weight = 0, activeWeight: requestedWeight = 0 } = {}) {
    if (typeof task !== 'function' || (signal !== undefined && !(signal instanceof AbortSignal))
      || !Number.isSafeInteger(weight) || weight < 0 || !Number.isSafeInteger(requestedWeight) || requestedWeight < 0) return Promise.reject(new TypeError('Invalid work admission request'));
    if (signal?.aborted) return Promise.reject(error('cancelled'));
    const mustWait = active >= concurrency || queue.length > 0 || requestedWeight > activeLimit - activeWeight;
    if (requestedWeight > activeLimit || (mustWait && (queue.length >= maxQueued || weight > maxQueuedWeight - queuedWeight))) {
      return Promise.reject(error('capacity'));
    }
    return new Promise((resolve, reject) => {
      const entry = { task, signal, weight, activeWeight: requestedWeight, resolve, reject };
      if (!mustWait) { start(entry); return; }
      entry.expiresAt = now() + queueTimeoutMs;
      entry.abort = () => remove(entry, 'cancelled');
      entry.timer = setTimeout(() => remove(entry, 'capacity'), queueTimeoutMs);
      queue.push(entry); queuedWeight += weight;
      signal?.addEventListener('abort', entry.abort, { once: true });
      if (signal?.aborted) entry.abort();
    });
  }
  return { run, getState: () => ({ active, queued: queue.length, queuedWeight,
    ...(maxActiveWeight === undefined ? {} : { activeWeight }) }) };
}
