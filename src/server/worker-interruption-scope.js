/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { throwIfOperationRunCancellationRequested } from './operation-run-cancellation.js';

/** Poll only while owned work runs; never release it on an abort notification. */
export async function withOperationRunInterruption({ isCancellationRequested, runId, pollIntervalMs = 1000,
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }, work) {
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 60_000) throw new TypeError('Invalid interruption interval');
  if (!isCancellationRequested) return work(undefined);
  const controller = new AbortController();
  let stopped = false; let failed = false; let failure; let timer; let pending;
  const remember = error => {
    if (failed) return;
    failed = true; failure = error; controller.abort(error);
  };
  const check = async () => {
    try { await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId }); }
    catch (error) { remember(error); }
  };
  const schedule = () => {
    timer = setTimeoutFn(() => {
      pending = check().then(() => { if (!stopped && !failed) schedule(); }).catch(remember);
    }, pollIntervalMs);
  };
  let result;
  try { schedule(); result = await work(controller.signal); }
  catch (error) { remember(error); }
  stopped = true;
  try { clearTimeoutFn(timer); } catch (error) { remember(error); }
  await pending;
  if (!failed) await check();
  if (failed) throw failure;
  return result;
}
