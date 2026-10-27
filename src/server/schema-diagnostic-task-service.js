/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const schemaDiagnosticTimeoutMs = 20_000;
const unavailable = () => Object.assign(new Error('Schema diagnostics deadline or cancellation reached.'), { code: 'schema_diagnostics_unavailable' });

/** Separate caller completion from actual drainage; neither late results nor retries own old work. */
export function startSchemaDiagnosticTask(work, { signal, timeoutMs = schemaDiagnosticTimeoutMs } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('A positive diagnostic timeout is required');
  const controller = new AbortController(), expiresAt = performance.now() + timeoutMs;
  let safeToReadmit = true;
  const cancel = () => controller.abort(unavailable());
  const check = () => {
    if (performance.now() >= expiresAt) cancel();
    controller.signal.throwIfAborted();
  };
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  let rejectAbort;
  const aborted = new Promise((_resolve, reject) => { rejectAbort = () => reject(controller.signal.reason); });
  controller.signal.addEventListener('abort', rejectAbort, { once: true });
  if (controller.signal.aborted) rejectAbort();
  const execution = Promise.resolve().then(() => { check(); return work({ signal: controller.signal, check,
    markRetirementUncertain: () => { safeToReadmit = false; } }); });
  const completion = execution.finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectAbort);
  });
  const drained = completion.then(() => safeToReadmit, () => safeToReadmit);
  const result = Promise.race([completion, aborted]).then(value => { check(); return value; });
  return { result, drained };
}
