/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Register completion before launch, and retain ownership through every finalizer. */
export function createWorkerTaskLifecycle({ execute, schedule = queueMicrotask } = {}) {
  if (typeof execute !== 'function' || typeof schedule !== 'function') {
    throw new TypeError('Worker execution and scheduling functions are required');
  }
  const active = new Map();
  let closing;
  let failed = false;
  let failure;

  function start(input) {
    if (closing) {
      throw Object.assign(new Error('Worker admission is closed'), { code: 'worker_closing' });
    }
    const key = input.runId;
    if (active.has(key)) return active.get(key).promise;
    const completion = Promise.withResolvers();
    const observed = completion.promise.then(() => { active.delete(key); }, error => {
      active.delete(key);
      if (!failed) { failed = true; failure = error; }
    });
    active.set(key, { promise: completion.promise, observed });
    let launched = false;
    let cancelled = false;
    try {
      schedule(() => {
        if (launched || cancelled) return;
        launched = true;
        Promise.resolve().then(() => cancelled ? undefined : execute(input))
          .then(completion.resolve, completion.reject);
      });
    } catch (error) {
      cancelled = true;
      completion.reject(error);
      throw error;
    }
    return completion.promise;
  }

  function close() {
    if (!closing) {
      closing = Promise.all([...active.values()].map(task => task.observed)).then(() => {
        if (failed) throw failure;
      });
    }
    return closing;
  }

  return { start, close };
}
