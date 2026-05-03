/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { spawn } from 'node:child_process';

const defaultSpawn = spawn;

function normalizeAllowedBinaries(value) {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(value
    .filter((binary) => typeof binary === 'string' && binary.trim().length > 0)
    .map((binary) => binary.trim().toLowerCase()));
}

function appendChunk(chunks, currentSize, chunk, maxBuffer) {
  const remaining = maxBuffer - currentSize;
  if (remaining <= 0) {
    return currentSize;
  }

  const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
  chunks.push(slice);
  return currentSize + slice.length;
}

function createCommandError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

export function createMediaCommandService({
  allowedBinaries = [],
  defaultKillGraceMs = 5000,
  defaultMaxBuffer = 1024 * 1024,
  defaultTimeoutMs = 5000,
  onCommandExit = () => {},
  onCommandStart = () => {},
  onCommandWarning = () => {},
  spawnFn = defaultSpawn,
} = {}) {
  const allowedBinarySet = normalizeAllowedBinaries(allowedBinaries);

  async function runCommand({
    args = [],
    binary,
    killGraceMs = defaultKillGraceMs,
    killSignal = 'SIGTERM',
    label = null,
    maxBuffer = defaultMaxBuffer,
    signal = null,
    timeoutMs = defaultTimeoutMs,
  }) {
    if (typeof binary !== 'string' || binary.trim().length === 0) {
      throw new Error('runCommand requires binary');
    }

    const normalizedBinary = binary.trim();
    if (allowedBinarySet.size > 0 && !allowedBinarySet.has(normalizedBinary.toLowerCase())) {
      const error = new Error(`Binary is not allowlisted for media command execution: ${normalizedBinary}`);
      error.code = 'media_command_binary_not_allowed';
      throw error;
    }

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawnFn(normalizedBinary, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const stdoutChunks = [];
      const stderrChunks = [];
      let stdoutSize = 0;
      let stderrSize = 0;
      let settled = false;
      let terminationReason = null;
      let killTimer = null;
      let timeoutHandle = null;
      let abortListener = null;

      function clearTimers() {
        clearTimeout(timeoutHandle);
        clearTimeout(killTimer);
      }

      function cleanup() {
        clearTimers();
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
      }

      function finalizeError(error) {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      }

      function finalizeSuccess(result) {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(result);
      }

      function buildOutputDetails() {
        return {
          durationMs: Date.now() - startedAt,
          pid: child.pid ?? null,
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        };
      }

      function requestTermination(reason, message) {
        if (terminationReason) {
          return;
        }

        terminationReason = reason;
        onCommandWarning({
          args,
          binary: normalizedBinary,
          label,
          message,
          pid: child.pid ?? null,
          reason,
        });

        child.kill(killSignal);
        killTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            onCommandWarning({
              args,
              binary: normalizedBinary,
              label,
              message: `${message} Escalating to SIGKILL after ${killGraceMs}ms.`,
              pid: child.pid ?? null,
              reason: `${reason}_force_kill`,
            });
            child.kill('SIGKILL');
          }
        }, killGraceMs);
      }

      onCommandStart({
        args,
        binary: normalizedBinary,
        label,
        pid: child.pid ?? null,
      });

      child.on('error', (error) => {
        finalizeError(error);
      });

      child.stdout?.on('data', (chunk) => {
        stdoutSize = appendChunk(stdoutChunks, stdoutSize, chunk, maxBuffer);
        if (stdoutSize >= maxBuffer || stderrSize >= maxBuffer) {
          requestTermination(
            'max_buffer_exceeded',
            `Media command exceeded the configured output buffer limit of ${maxBuffer} bytes.`,
          );
        }
      });

      child.stderr?.on('data', (chunk) => {
        stderrSize = appendChunk(stderrChunks, stderrSize, chunk, maxBuffer);
        if (stdoutSize >= maxBuffer || stderrSize >= maxBuffer) {
          requestTermination(
            'max_buffer_exceeded',
            `Media command exceeded the configured output buffer limit of ${maxBuffer} bytes.`,
          );
        }
      });

      child.on('close', (code, signalCode) => {
        const output = buildOutputDetails();
        onCommandExit({
          args,
          binary: normalizedBinary,
          durationMs: output.durationMs,
          exitCode: code,
          label,
          pid: child.pid ?? null,
          signalCode,
          terminationReason,
        });

        if (terminationReason === 'timeout') {
          finalizeError(createCommandError(
            `Media command timed out after ${timeoutMs}ms`,
            {
              ...output,
              code: 'ETIMEDOUT',
              exitCode: code,
              signalCode,
              timedOut: true,
            },
          ));
          return;
        }

        if (terminationReason === 'aborted') {
          finalizeError(createCommandError(
            'Media command was aborted',
            {
              ...output,
              code: 'ABORT_ERR',
              exitCode: code,
              signalCode,
            },
          ));
          return;
        }

        if (terminationReason === 'max_buffer_exceeded') {
          finalizeError(createCommandError(
            `Media command output exceeded maxBuffer (${maxBuffer} bytes)`,
            {
              ...output,
              code: 'MEDIA_COMMAND_MAX_BUFFER_EXCEEDED',
              exitCode: code,
              signalCode,
            },
          ));
          return;
        }

        if (code !== 0) {
          finalizeError(createCommandError(
            `Media command exited with code ${code ?? 'null'}`,
            {
              ...output,
              code: 'MEDIA_COMMAND_EXIT_NON_ZERO',
              exitCode: code,
              signalCode,
            },
          ));
          return;
        }

        finalizeSuccess({
          ...output,
          exitCode: code,
          signalCode,
        });
      });

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          requestTermination(
            'timeout',
            `Media command exceeded timeout after ${timeoutMs}ms.`,
          );
        }, timeoutMs);
      }

      if (signal) {
        if (signal.aborted) {
          requestTermination('aborted', 'Media command aborted before completion.');
        } else {
          abortListener = () => {
            requestTermination('aborted', 'Media command aborted before completion.');
          };
          signal.addEventListener('abort', abortListener, { once: true });
        }
      }
    });
  }

  return {
    runCommand,
  };
}
