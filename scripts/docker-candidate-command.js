/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function createCandidateDockerCommand({ execFileFn = promisify(execFile) } = {}) {
  return async function runCommand({ command, args, env, cwd, timeoutMs = 240_000, expectedExitCodes = [0] }) {
    if (command !== 'docker' || !Array.isArray(args)) throw new Error('Candidate acceptance only executes Docker commands');
    try {
      const result = await execFileFn('docker', args, {
        cwd, env, encoding: 'utf8', maxBuffer: 4_194_304, timeout: timeoutMs,
        shell: false, windowsHide: true,
      });
      if (!expectedExitCodes.includes(0)) throw new Error('Unexpected successful Docker command');
      return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      if (!error.killed && Number.isInteger(error.code) && expectedExitCodes.includes(error.code)) {
        return { exitCode: error.code, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') };
      }
      // Compose and application diagnostics can include generated secrets. Keep
      // the step classification, never echo arguments, environment, or raw logs.
      throw Object.assign(new Error(`Candidate Docker ${args[0] === 'compose' ? 'Compose' : 'runtime'} command failed or exceeded its limit`), {
        code: 'candidate_docker_command_failed',
      });
    }
  };
}
