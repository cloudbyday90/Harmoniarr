/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Keep caller completion separate from actual work and resource retirement. */
export function startDeadlineTask(work, { signal, timeoutMs, createTimeoutError } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new TypeError('A positive bounded timeout is required');
  if (typeof createTimeoutError !== 'function') throw new TypeError('A timeout error factory is required');
  const controller = new AbortController(), expiresAt = performance.now() + timeoutMs;
  let safeToReadmit = true;
  const cancel = () => controller.abort(createTimeoutError());
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
