/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function createRecoveryDockerCommand({ execFileFn = promisify(execFile), env = process.env } = {}) {
  return async function runDocker(args, { environment = {}, expectedExitCodes = [0], timeoutMs = 60_000 } = {}) {
    try {
      const result = await execFileFn('docker', args, {
        env: { ...env, ...environment }, encoding: 'utf8', maxBuffer: 1_048_576,
        timeout: timeoutMs, windowsHide: true, shell: false,
      });
      return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      if (!error.killed && Number.isInteger(error.code) && expectedExitCodes.includes(error.code)) {
        return { exitCode: error.code, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') };
      }
      throw Object.assign(new Error('The isolated PostgreSQL Docker command failed or exceeded its limit'), {
        code: 'postgres_recovery_command_failed',
      });
    }
  };
}
