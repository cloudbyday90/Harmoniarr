/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';

function formatCommand(command, args) {
  return [command, ...(Array.isArray(args) ? args : [])].join(' ');
}

export function formatBufferedCommandFailure({
  args,
  command,
  exitCode,
  stderr = '',
  stdout = '',
} = {}) {
  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  return `${formatCommand(command, args)} failed with exit code ${exitCode}${output ? `\n${output}` : ''}`;
}

export async function runBufferedCommand({
  args = [],
  command,
  cwd = process.cwd(),
  env = process.env,
  expectedExitCodes = [0],
  spawnFn = spawn,
  stdio = ['ignore', 'pipe', 'pipe'],
  windowsHide = true,
} = {}) {
  if (!command) {
    throw new Error('command is required');
  }

  const child = spawnFn(command, args, {
    cwd,
    env,
    stdio,
    windowsHide,
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const { exitCode } = await Promise.race([
    once(child, 'close').then(([resolvedExitCode]) => ({ exitCode: resolvedExitCode })),
    once(child, 'error').then(([error]) => {
      throw error;
    }),
  ]);

  if (!expectedExitCodes.includes(exitCode)) {
    throw new Error(formatBufferedCommandFailure({
      args,
      command,
      exitCode,
      stderr,
      stdout,
    }));
  }

  return {
    exitCode,
    stderr,
    stdout,
  };
}