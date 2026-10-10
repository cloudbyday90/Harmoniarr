/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

function cancellationReason(signal) {
  return signal.reason !== undefined ? signal.reason : new DOMException('The fixture was cancelled', 'AbortError');
}

function assertSignal(signal) {
  if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function')) throw new TypeError('Fixture signal must be an AbortSignal');
}

async function withCancellation(operation, signal) {
  assertSignal(signal);
  const observed = Promise.resolve(operation);
  observed.catch(() => {});
  if (!signal) return observed;
  if (signal.aborted) throw cancellationReason(signal);
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(cancellationReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([observed, cancelled]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

/** A controlled fixture dependency rejects on cancellation; it never certifies that unrelated work stopped. */
export function createFixtureGate({ signal } = {}) {
  assertSignal(signal);
  let resolve; let reject; let settled = false;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  // A registered gate can be cancelled before its consumer starts awaiting it.
  // Keep that rejection observed while returning the original promise to callers.
  promise.catch(() => {});
  const onAbort = () => abort(cancellationReason(signal));
  function finish(callback, value) {
    if (settled) return false;
    settled = true; signal?.removeEventListener('abort', onAbort); callback(value); return true;
  }
  function release(value) { return finish(resolve, value); }
  function abort(reason = new DOMException('The fixture gate was cancelled', 'AbortError')) { return finish(reject, reason); }
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  return { promise, release, abort };
}

/** Do not wait for a readiness checkpoint that an already-settled operation can no longer reach. */
export async function waitForFixtureReady({ ready, operation, signal } = {}) {
  if (!ready || typeof ready.then !== 'function' || !operation || typeof operation.then !== 'function') {
    throw new TypeError('Fixture readiness requires ready and operation promises');
  }
  const completedBeforeReady = Promise.resolve(operation).then(() => {
    throw Object.assign(new Error('Fixture operation completed before required readiness'), {
      code: 'fixture_operation_completed_before_ready',
    });
  });
  return withCancellation(Promise.race([ready, completedBeforeReady]), signal);
}

/** Registered cooperative work must actually settle before its scenario resources can be reused. */
export async function withFixtureLifecycle({ signal } = {}, work) {
  assertSignal(signal);
  if (typeof work !== 'function') throw new TypeError('Fixture lifecycle requires work');
  const controller = new AbortController(); const releases = []; const drains = [];
  let closed = false; let firstError; let failed = false; let cancellationSource = null;
  const cancel = (reason, source) => {
    if (controller.signal.aborted) return;
    cancellationSource = source;
    controller.abort(reason);
  };
  const remember = (error) => {
    if (!failed) { failed = true; firstError = error; }
    cancel(firstError, 'failure');
  };
  const onAbort = () => cancel(cancellationReason(signal), 'parent');
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  const scope = {
    signal: controller.signal,
    onRelease(callback) {
      if (closed || typeof callback !== 'function') throw new TypeError('Fixture release must be registered before cleanup');
      releases.push(callback); return callback;
    },
    track(operation) {
      if (closed || !operation || typeof operation.then !== 'function') throw new TypeError('Fixture work must be a registered promise');
      drains.push(Promise.resolve(operation).then(() => ({ failed: false }), (error) => {
        // Observe a later rejection immediately, even while an earlier drain
        // waits for this signal before it can finish.
        remember(error);
        return { failed: true, error };
      }));
      return operation;
    },
  };
  let result;
  const operation = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw cancellationReason(controller.signal);
    return work(scope);
  });
  const bodyOutcome = operation.then(() => ({ failed: false }), (error) => ({ failed: true, error }));
  scope.track(operation);
  try { result = await withCancellation(operation, controller.signal); }
  catch (error) { remember(error); }
  closed = true;
  for (const release of releases) {
    try { await release(failed ? firstError : undefined); }
    catch (error) { remember(error); }
  }
  // track() immediately observes rejections. Drain every registered task, even
  // after a release callback or earlier task fails, without replacing its cause.
  for (const drain of drains) {
    const outcome = await drain;
    if (outcome.failed) remember(outcome.error);
  }
  // A background failure can wake the cancellation race before the body's own
  // rejection settles. Preserve that actual body error over cleanup fallout;
  // an already-observed parent cancellation keeps its original reason.
  const body = await bodyOutcome;
  if (body.failed && cancellationSource !== 'parent') { failed = true; firstError = body.error; }
  signal?.removeEventListener('abort', onAbort);
  if (failed) throw firstError;
  return result;
}

/** Observe injected lifecycle adapters without throwing from the worker's detached finally/catch. */
export function createFixtureWorkerObserver({ callbacks } = {}) {
  if (typeof callbacks?.releaseLease !== 'function') throw new TypeError('Worker observation requires releaseLease');
  let accept; let reject; let firstError; let failed = false; let settled = false;
  const finished = new Promise((resolve, fail) => { accept = resolve; reject = fail; });
  finished.catch(() => {});
  const remember = (error) => { if (!failed) { failed = true; firstError = error; } };
  const complete = () => {
    if (settled) return;
    settled = true;
    if (failed) reject(firstError); else accept();
  };
  const observed = {};
  for (const name of ['acquireLease', 'markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunCancelled', 'markRunPaused', 'releaseLease']) {
    if (typeof callbacks[name] !== 'function') continue;
    observed[name] = async (...args) => {
      try {
        const result = await callbacks[name](...args);
        if (name === 'releaseLease' || (name === 'acquireLease' && !result)) complete();
        return result;
      } catch (error) {
        remember(error);
        if (name === 'releaseLease' || name === 'acquireLease') complete();
        return name === 'acquireLease' ? null : false;
      }
    };
  }
  return { callbacks: observed, finished };
}
