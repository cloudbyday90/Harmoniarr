/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
function appendChunk(chunks, currentSize, chunk, maxBuffer) {
  const remaining = maxBuffer - currentSize;
  if (remaining <= 0) return currentSize;
  const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
  chunks.push(slice);
  return currentSize + slice.length;
}

const commandError = (message, details) => Object.assign(new Error(message), details);

// Diagnostics never own command completion, cancellation or admission capacity.
function notify(handler, event) {
  try { void Promise.resolve(handler(event)).catch(() => {}); } catch { /* optional diagnostic */ }
}

export function executeMediaCommand({ binary, args, label, maxBuffer, timeoutMs, killGraceMs, killSignal, signal },
  { spawnFn, onCommandStart, onCommandExit, onCommandWarning }) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    // A synchronous throw has no returned child to retire.
    const child = spawnFn(binary, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const stdoutChunks = []; const stderrChunks = [];
    let stdoutSize = 0; let stderrSize = 0; let closed = false;
    let failed = false; let failure; let terminationReason = null;
    let killTimer; let timeoutHandle;
    const remember = error => { if (!failed) { failed = true; failure = error; } };
    const event = details => ({ args, binary, label, pid: child.pid ?? null, ...details });
    function kill(requestedSignal) {
      // exit can precede stdio close. Retain the slot but never signal a retired PID.
      if (closed || child.exitCode !== null || child.signalCode !== null) return;
      try { child.kill(requestedSignal); } catch (error) { remember(error); }
    }
    function requestTermination(reason, message) {
      if (closed || terminationReason) return;
      terminationReason = reason;
      notify(onCommandWarning, event({ message, reason }));
      // Install escalation first: a kill adapter may synchronously emit close.
      killTimer = setTimeout(() => {
        if (closed || child.exitCode !== null || child.signalCode !== null) return;
        notify(onCommandWarning, event({ message: `${message} Escalating to SIGKILL after ${killGraceMs}ms.`, reason: `${reason}_force_kill` }));
        kill('SIGKILL');
      }, killGraceMs);
      kill(killSignal);
    }
    const abort = () => requestTermination('aborted', 'Media command aborted before completion.');
    child.on('error', error => {
      remember(error);
      if (child.pid != null) requestTermination('process_error', 'Media command process failed.');
    });
    const capture = (chunks, size, chunk) => {
      const next = appendChunk(chunks, size, chunk, maxBuffer);
      if (next >= maxBuffer) requestTermination('max_buffer_exceeded', `Media command exceeded the configured output buffer limit of ${maxBuffer} bytes.`);
      return next;
    };
    child.stdout?.on('data', chunk => { stdoutSize = capture(stdoutChunks, stdoutSize, chunk); });
    child.stderr?.on('data', chunk => { stderrSize = capture(stderrChunks, stderrSize, chunk); });
    child.once('close', (code, signalCode) => {
      closed = true; clearTimeout(timeoutHandle); clearTimeout(killTimer); signal?.removeEventListener('abort', abort);
      const output = { durationMs: Date.now() - startedAt, pid: child.pid ?? null,
        stderr: Buffer.concat(stderrChunks).toString('utf8'), stdout: Buffer.concat(stdoutChunks).toString('utf8') };
      notify(onCommandExit, event({ durationMs: output.durationMs, exitCode: code, signalCode, terminationReason }));
      if (failed) { reject(failure); return; }
      const details = { ...output, exitCode: code, signalCode };
      if (terminationReason === 'timeout') {
        reject(commandError(`Media command timed out after ${timeoutMs}ms`, { ...details, code: 'ETIMEDOUT', timedOut: true }));
      } else if (terminationReason === 'aborted') {
        reject(commandError('Media command was aborted', { ...details, code: 'ABORT_ERR' }));
      } else if (terminationReason === 'max_buffer_exceeded') {
        reject(commandError(`Media command output exceeded maxBuffer (${maxBuffer} bytes)`, { ...details, code: 'MEDIA_COMMAND_MAX_BUFFER_EXCEEDED' }));
      } else if (code !== 0 || signalCode) {
        reject(commandError(`Media command exited with code ${code ?? 'null'}`, { ...details, code: 'MEDIA_COMMAND_EXIT_NON_ZERO' }));
      } else resolve(details);
    });
    if (timeoutMs > 0) timeoutHandle = setTimeout(() => requestTermination('timeout', `Media command exceeded timeout after ${timeoutMs}ms.`), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    notify(onCommandStart, event({}));
  });
}
