/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { spawn } from 'node:child_process';

const incomplete = () => ({ quiescent: false, code: 'fixture_process_tree_incomplete' });
const complete = () => ({ quiescent: true, code: null });

function observeClose(child, suppliedPromise) {
  let closed = false;
  let outcome;
  let resolve;
  const observed = new Promise((accept) => { resolve = accept; });
  const onClose = (exitCode, signal) => { closed = true; outcome = { exitCode, signal }; resolve(outcome); };
  // A subprocess error does not replace the close boundary; keep it observed.
  const onError = () => {};
  child.on('error', onError);
  child.once('close', onClose);
  if (suppliedPromise) {
    Promise.resolve(suppliedPromise).then((value) => {
      closed = true; outcome = value; resolve(value);
    }, () => {});
  }
  return { promise: observed, isClosed: () => closed, outcome: () => outcome,
    cleanup() { child.removeListener('error', onError); child.removeListener('close', onClose); } };
}

async function waitForClose(observation, milliseconds, setTimeoutFn, clearTimeoutFn) {
  if (observation.isClosed()) return true;
  let timer;
  try {
    return await Promise.race([
      observation.promise.then(() => true),
      new Promise((resolve) => { timer = setTimeoutFn(() => resolve(false), milliseconds); }),
    ]);
  } finally { if (timer !== undefined) clearTimeoutFn(timer); }
}

/** Quiescence means observed runner close, not proof of every unregistered descendant's exit. */
export async function terminateOwnedProcessTree({ child, platform = process.platform,
  spawnFn = spawn, killGroupFn = process.kill.bind(process), closePromise,
  graceMs = 1000, killWaitMs = 3000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
  if (!child || typeof child.on !== 'function' || typeof child.once !== 'function'
    || typeof child.removeListener !== 'function') return incomplete();
  if (![spawnFn, killGroupFn, setTimeoutFn, clearTimeoutFn].every((fn) => typeof fn === 'function')
    || ![graceMs, killWaitMs].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 30_000)) {
    throw new TypeError('Invalid owned process termination dependencies');
  }
  const target = observeClose(child, closePromise);
  let terminator;
  try {
    // Capture only the actual spawned child's identity, once. Reported worker
    // identities never enter this adapter's termination authority.
    const pid = child.pid;
    await Promise.resolve();
    if (target.isClosed()) return complete();
    const validPid = Number.isSafeInteger(pid) && pid > 1 && pid <= 2_147_483_647;
    const exited = child.exitCode != null || child.signalCode != null;
    if (!validPid || exited) {
      return await waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn) ? complete() : incomplete();
    }
    if (platform === 'win32') {
      let command;
      try {
        command = spawnFn('taskkill.exe', ['/PID', String(pid), '/T', '/F'],
          { shell: false, windowsHide: true, stdio: 'ignore' });
      } catch {
        await waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn);
        return incomplete();
      }
      terminator = observeClose(command);
      const [commandClosed, targetClosed] = await Promise.all([
        waitForClose(terminator, killWaitMs, setTimeoutFn, clearTimeoutFn),
        waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn),
      ]);
      if (!commandClosed) {
        // The helper process is owned too. Reap it without promoting an expired
        // termination observation into a verified runner-tree outcome.
        try { command.kill?.('SIGKILL'); } catch { /* Preserve incomplete termination. */ }
        await waitForClose(terminator, killWaitMs, setTimeoutFn, clearTimeoutFn);
      }
      return commandClosed && targetClosed && terminator.outcome()?.exitCode === 0 ? complete() : incomplete();
    }
    try { killGroupFn(-pid, 'SIGTERM'); }
    catch {
      await waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn);
      return incomplete();
    }
    if (await waitForClose(target, graceMs, setTimeoutFn, clearTimeoutFn)) return complete();
    try { killGroupFn(-pid, 'SIGKILL'); }
    catch {
      await waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn);
      return incomplete();
    }
    return await waitForClose(target, killWaitMs, setTimeoutFn, clearTimeoutFn) ? complete() : incomplete();
  } finally { target.cleanup(); terminator?.cleanup(); }
}
