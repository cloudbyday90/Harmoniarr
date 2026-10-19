/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';

/** Callback failure/abort is provisional until the actual process and stdio close. */
export async function executeFixtureProbeCommand(binary, args, { signal, timeout = 30_000,
  execFileFn = execFile } = {}) {
  if (typeof binary !== 'string' || !binary || !Array.isArray(args) || args.some(arg => typeof arg !== 'string')
    || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000 || typeof execFileFn !== 'function') {
    throw new TypeError('Invalid fixture prerequisite command');
  }
  if (signal?.aborted) throw signal.reason;
  let complete; let failed = false; let failure;
  const capture = error => { if (!failed) { failed = true; failure = error; } };
  const outcome = new Promise(resolve => { complete = resolve; });
  const child = execFileFn(binary, args, { shell: false, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
    timeout, killSignal: 'SIGKILL', ...(signal ? { signal } : {}) },
  (error, stdout, stderr) => {
    if (error) capture(signal?.aborted ? signal.reason : error);
    complete({ stdout, stderr });
  });
  const observeError = error => capture(signal?.aborted ? signal.reason : error);
  const onAbort = () => capture(signal.reason);
  child.on('error', observeError);
  const closed = new Promise(resolve => { child.once('close', resolve); });
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  try {
    const result = await outcome;
    await closed;
    if (failed) throw failure;
    return { stdout: result.stdout, stderr: result.stderr };
  } finally { child.removeListener('error', observeError); signal?.removeEventListener('abort', onAbort); }
}
