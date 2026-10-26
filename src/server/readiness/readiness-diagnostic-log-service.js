/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { incrementDiagnosticCount, readinessLogIntervalMs } from './readiness-diagnostic-policy.js';

/** One bounded line per interval; never queue another write behind backpressure. */
export function createReadinessDiagnosticLogService({ stream = process.stderr, nowFn = () => performance.now() } = {}) {
  let lastEmission = -Infinity, blocked = false, closing = false, suppressedCount = 0, loggedCount = 0;
  let pending = null, unavailable = false, observingErrors = false, closePromise;
  const onDrain = () => { blocked = false; };
  function settlePending() { const work = pending; pending = null; work?.resolve(); }
  function onError() {
    if (!unavailable) suppressedCount = incrementDiagnosticCount(suppressedCount);
    unavailable = true; settlePending();
  }
  function writeFailure(record) {
    if (closing) return;
    const now = nowFn();
    if (pending || blocked || unavailable || now - lastEmission < readinessLogIntervalMs) { suppressedCount = incrementDiagnosticCount(suppressedCount); return; }
    lastEmission = now;
    // record is the diagnostics service's closed scalar schema, never an Error/request/overview.
    const line = '[harmoniarr-readiness] ' + JSON.stringify({ event: 'readiness_failure', ...record }) + '\n';
    const work = Promise.withResolvers(); pending = work;
    try {
      if (!observingErrors) { stream.on?.('error', onError); observingErrors = true; }
      if (stream.write(line, error => {
        if (pending !== work) return;
        if (error) onError();
        else { loggedCount = incrementDiagnosticCount(loggedCount); settlePending(); }
      }) === false) {
        blocked = true;
        stream.once('drain', onDrain);
      }
    } catch { onError(); }
  }
  function close() {
    if (!closePromise) {
      closing = true;
      closePromise = (async () => {
        await pending?.promise;
        // Writable errors can follow the write callback on the next tick.
        if (observingErrors) await new Promise(resolve => { setImmediate(resolve); });
        stream.removeListener?.('drain', onDrain); stream.removeListener?.('error', onError);
      })();
    }
    return closePromise;
  }
  return { writeFailure, close, getState: () => ({ loggedCount, suppressedCount, backpressured: blocked, outputUnavailable: unavailable }) };
}
