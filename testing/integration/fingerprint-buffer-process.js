/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { terminateOwnedProcessTree } from './owned-process-tree.js';
import { resolveOperatorTrackReadBuffer, resolveOperatorTrackReadMethod } from '../../src/server/metadata/operator-track-fingerprint-policy.js';

export async function runFingerprintBufferProbe({ filePath, libraryRoot, readBufferBytes, readMethod, signal,
  spawnFn = spawn, terminateFn = terminateOwnedProcessTree, onTermination = () => {} } = {}) {
  signal?.throwIfAborted(); resolveOperatorTrackReadBuffer(readBufferBytes); const method = resolveOperatorTrackReadMethod(readMethod);
  if (typeof filePath !== 'string' || typeof libraryRoot !== 'string' || !filePath || !libraryRoot) throw new TypeError('Invalid fingerprint probe paths');
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'LANG'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  const child = spawnFn(process.execPath, ['--expose-gc', fileURLToPath(new URL('./fingerprint-buffer-probe.js', import.meta.url)), filePath, libraryRoot, String(readBufferBytes), method],
    { shell: false, windowsHide: true, detached: process.platform !== 'win32', env, stdio: ['ignore', 'pipe', 'pipe'] });
  let failed = false; let failure; let output = ''; let outputBytes = 0; let stop; let didClose = false; let markIncomplete;
  const incomplete = new Promise(resolve => { markIncomplete = resolve; });
  const closed = new Promise(resolve => { child.once('close', (code, closeSignal) => { didClose = true; resolve({ code, signal: closeSignal }); }); });
  function fail(error) {
    if (!failed) { failed = true; failure = error; }
    stop ??= (async () => {
      let quiescent = false;
      try { quiescent = (await terminateFn({ child, closePromise: closed }))?.quiescent === true; } catch { /* Preserve primary failure. */ }
      if (!quiescent) markIncomplete();
    })(); stop.catch(() => {});
  }
  const onAbort = () => fail(signal.reason); const onError = error => fail(error);
  child.on('error', onError); signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const timer = setTimeout(() => fail(new Error('Fingerprint probe exceeded its bounded process duration')), 30_000);
  child.stdout.on('data', chunk => {
    outputBytes += chunk.length;
    if (outputBytes > 32 * 1024) { fail(new Error('Fingerprint probe output exceeded its bound')); return; }
    output += chunk.toString('utf8');
  });
  child.stderr.on('data', () => { /* Private failures are reported only as a bounded category. */ });
  try {
    const result = await Promise.race([closed, incomplete]);
    if (stop) await stop;
    try { await onTermination({ quiescent: didClose }); } catch { /* Preserve primary failure. */ }
    if (failed) throw failure;
    if (result.code !== 0 || result.signal) throw new Error('Fingerprint probe failed');
    return JSON.parse(output);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
    if (didClose) child.removeListener('error', onError);
    else child.once('close', () => child.removeListener('error', onError));
  }
}
