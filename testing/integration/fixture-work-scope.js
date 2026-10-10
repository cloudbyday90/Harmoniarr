/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createFixtureGate, withFixtureLifecycle } from './fixture-lifecycle.js';

function assertScope(scope) {
  if (typeof scope?.track !== 'function' || typeof scope.onRelease !== 'function'
    || typeof scope.signal?.aborted !== 'boolean' || typeof scope.signal.addEventListener !== 'function'
    || typeof scope.signal.removeEventListener !== 'function') throw new TypeError('Controlled fixture work requires a lifecycle scope');
  if (scope.signal.aborted) throw scope.signal.reason;
}

export function createScopedFixtureGate(scope) {
  assertScope(scope);
  const gate = createFixtureGate({ signal: scope.signal });
  try { scope.onRelease(() => { gate.release(); }); }
  catch (error) { gate.abort(error); throw error; }
  return gate;
}

/** Register actual completion before invoking a direct asynchronous operation. */
export function startScopedFixtureWork(scope, run) {
  assertScope(scope);
  if (typeof run !== 'function') throw new TypeError('Controlled fixture work requires a callback');
  const startup = createFixtureGate();
  const operation = startup.promise.then(() => {
    if (scope.signal.aborted) throw scope.signal.reason;
    return run(scope.signal);
  });
  operation.catch(() => {});
  try { scope.track(operation); startup.release(); }
  catch (error) { startup.abort(error); throw error; }
  return operation;
}

/** Deferred resource finalizers run after gates release and registered work drains. */
export async function withFixtureWorkScope({ signal } = {}, work) {
  if (typeof work !== 'function') throw new TypeError('Fixture work scope requires a callback');
  const finalizers = []; let closed = false; let failed = false; let failure; let result;
  try {
    result = await withFixtureLifecycle({ signal }, (scope) => work({ ...scope,
      onAfterDrain(callback) {
        if (closed || typeof callback !== 'function') throw new TypeError('Fixture finalizer must be registered before settlement');
        finalizers.push(callback);
      },
    }));
  } catch (error) { failed = true; failure = error; }
  closed = true;
  for (const finalize of finalizers) {
    try { await finalize(); }
    catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
  return result;
}
