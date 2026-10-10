/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { terminateOwnedProcessTree } from './owned-process-tree.js';

function assertSignal(signal) {
  if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function')) throw new TypeError('Invalid test process signal');
}

function writeChunk(destination, chunk, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, failed = false) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      destination.removeListener?.('error', onError);
      if (failed) reject(error); else resolve();
    };
    const onAbort = () => finish(signal.reason, true);
    const onError = (error) => finish(error, true);
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    destination.once?.('error', onError);
    try { destination.write(chunk, (error) => finish(error, error != null)); }
    catch (error) { finish(error, true); }
  });
}

function incompleteError() {
  return Object.assign(new Error('Owned test process termination did not verify quiescence'),
    { code: 'fixture_process_tree_incomplete', quiescent: false });
}

function abandonedOutputError() {
  return Object.assign(new Error('Owned test output was abandoned after failure'),
    { code: 'fixture_process_output_abandoned', outputDrained: false });
}

export async function runPostgresTestFile({ file, cwd = process.cwd(), env = process.env, signal,
  stdout = process.stdout, stderr = process.stderr, onCancel = () => {}, onTermination = () => {},
  spawnFn = spawn, terminateFn = terminateOwnedProcessTree } = {}) {
  assertSignal(signal);
  if (signal?.aborted) throw signal.reason;
  if (typeof file !== 'string' || !file.trim() || file.includes('\0') || file.startsWith('-')
    || typeof cwd !== 'string' || !env || typeof env !== 'object'
    || ![stdout, stderr].every((output) => typeof output?.write === 'function')
    || ![spawnFn, terminateFn, onCancel, onTermination].every((fn) => typeof fn === 'function')) {
    throw new TypeError('Invalid PostgreSQL test file process input');
  }
  const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = env;
  const started = performance.now();
  let child;
  try {
    child = spawnFn(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec',
      '--test-reporter=./testing/reporters/early-failure-reporter.js',
      '--test-reporter-destination=stdout', '--test-reporter-destination=stderr', file],
    { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
      windowsHide: true, detached: process.platform !== 'win32' });
  } catch (error) {
    await Promise.resolve().then(() => onCancel()).catch(() => {});
    await Promise.resolve().then(() => onTermination({ quiescent: true, code: null, outputDrained: true })).catch(() => {});
    throw error;
  }
  const drainController = new AbortController();
  let failed = false; let primaryError; let stopPromise; let resolveClose; let resolveIncomplete; let completedReaders = 0;
  const closePromise = new Promise((resolve) => { resolveClose = resolve; });
  const incomplete = new Promise((resolve) => { resolveIncomplete = resolve; });
  let closeResult;
  const onClose = (exitCode, closeSignal) => {
    closeResult = { exitCode, signal: closeSignal }; resolveClose(closeResult);
  };
  function remember(error) {
    if (!failed) { failed = true; primaryError = error; }
    if (stopPromise) return;
    stopPromise = (async () => {
      await Promise.resolve().then(() => onCancel()).catch(() => {});
      let termination;
      try { termination = await terminateFn({ child, closePromise }); }
      catch { termination = { quiescent: false, code: 'fixture_process_tree_incomplete' }; }
      const quiescent = termination?.quiescent === true;
      const outputDrained = completedReaders === 2;
      termination = { quiescent, code: quiescent ? null : 'fixture_process_tree_incomplete', outputDrained };
      if (!quiescent || !outputDrained) {
        drainController.abort(quiescent ? abandonedOutputError() : incompleteError());
        child.stdout?.destroy?.(); child.stderr?.destroy?.();
      }
      if (!quiescent) {
        resolveIncomplete();
      }
      await Promise.resolve().then(() => onTermination(termination)).catch(() => {});
    })();
    stopPromise.catch(() => {});
  }
  const onError = (error) => remember(error);
  const onAbort = () => remember(signal.reason);
  child.once('close', onClose);
  child.on('error', onError);
  const outputs = [[child.stdout, stdout], [child.stderr, stderr]];
  for (const [, destination] of outputs) destination.on?.('error', onError);
  async function consume(source, destination) {
    try {
      if (!source || typeof source[Symbol.asyncIterator] !== 'function') throw new TypeError('Test subprocess output is unavailable');
      for await (const chunk of source) await writeChunk(destination, chunk, drainController.signal);
      completedReaders += 1;
    } catch (error) { remember(error); }
  }
  const consumers = outputs.map(([source, destination]) => consume(source, destination));
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  try {
    await Promise.race([Promise.all([closePromise, ...consumers]), incomplete]);
    if (stopPromise) await stopPromise;
    if (drainController.signal.aborted) await Promise.allSettled(consumers);
    if (failed) throw primaryError;
    return { ...closeResult, durationMs: Math.max(0, performance.now() - started) };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    child.removeListener('close', onClose); child.removeListener('error', onError);
    for (const [, destination] of outputs) destination.removeListener?.('error', onError);
  }
}
