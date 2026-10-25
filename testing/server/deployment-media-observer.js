/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

/** Observe actual spawn/close. Gates coordinate lifetimes, never replace native work. */
export function createDeploymentMediaObserver({ spawnFn = spawn, signal = AbortSignal.timeout(20_000) } = {}) {
  const scanReady = Promise.withResolvers(); const encoderReady = Promise.withResolvers();
  const overlap = Promise.withResolvers(); const scanGate = Promise.withResolvers();
  for (const item of [scanReady, encoderReady, overlap]) void item.promise.catch(() => {});
  const records = []; let open = true; let scanActive = false; let observed = false; let artworkOverlap = false; let artworkStarts = 0;
  let failed = false; let failure; let peak = 0; let closing;
  const remember = error => {
    if (failed) return; failed = true; failure = error;
    for (const item of [scanReady, encoderReady, overlap]) item.reject(error);
    scanGate.resolve();
  };
  const abort = () => remember(signal.reason);
  signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  const active = kind => records.filter(row => row.started && !row.closed && (!kind || row.kind === kind));
  return {
    async enterScan() { assert.ok(open && !scanActive); scanActive = true; scanReady.resolve(); await scanGate.promise; if (failed) throw failure; },
    finishScan() { scanActive = false; },
    releaseScan: () => scanGate.resolve(),
    waitForScan: () => scanReady.promise,
    waitForEncoder: () => encoderReady.promise,
    waitForOverlap: () => overlap.promise,
    getActiveState: () => ({ scan: scanActive, encoder: active('encode').length > 0 }),
    observeArtworkSpawn() { artworkStarts++; if (scanActive && active('encode').length > 0) artworkOverlap = true; },
    spawnMedia(kind, binary, args, options) {
      if (!open || failed || !['encode', 'probe'].includes(kind) || records.length >= 64) throw new TypeError('Invalid native qualification launch');
      assert.equal(binary, kind === 'encode' ? 'ffmpeg' : 'ffprobe'); assert.equal(options.shell, false);
      const child = spawnFn(binary, args, options);
      const row = { kind, pid: child.pid, started: false, closed: false, code: null, signal: null };
      const closed = Promise.withResolvers(); records.push({ ...row, done: closed.promise }); const record = records.at(-1);
      child.once('spawn', () => {
        record.started = true; peak = Math.max(peak, active().length);
        if (kind === 'encode') encoderReady.resolve();
        if (kind === 'probe' && scanActive && active('encode').length > 0) { observed = true; overlap.resolve(); }
      });
      child.once('error', remember);
      child.once('close', (code, exitSignal) => {
        Object.assign(record, { closed: true, code, signal: exitSignal }); closed.resolve();
        if (code !== 0 || exitSignal) remember(new Error('Native media qualification command failed'));
        else if (kind === 'encode' && !observed) remember(new Error('Encoder retired before required native overlap'));
      });
      return child;
    },
    getState: () => ({ scanProbeEncodeOverlap: observed, scanEncoderArtworkOverlap: artworkOverlap, artworkStarts, maximumConcurrentNativeCommands: peak,
      encoderCommands: records.filter(row => row.kind === 'encode').length,
      probeCommands: records.filter(row => row.kind === 'probe').length,
      normalCloses: records.filter(row => row.closed && row.code === 0 && !row.signal).length }),
    close() {
      closing ??= (async () => {
        open = false; signal.removeEventListener('abort', abort); scanGate.resolve();
        await Promise.all(records.map(row => row.done));
        if (failed) throw failure;
        assert.ok(observed, 'Require actual scan/probe/encoder lifetime overlap');
        assert.ok(artworkOverlap, 'Require actual scan/encoder/artwork lifetime overlap');
        for (const row of records) { assert.ok(row.started && row.closed); assert.throws(() => process.kill(row.pid, 0), { code: 'ESRCH' }); }
      })();
      return closing;
    },
  };
}
