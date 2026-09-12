/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function createReleaseDraftCommand({ execFileFn = promisify(execFile) } = {}) {
  return async function runCommand({ args, env, timeoutMs = 60_000 }) {
    if (!Array.isArray(args) || !args.every((value) => typeof value === 'string')
      || !(args[0] === 'api' || args[0] === 'release' && args[1] === 'verify')) {
      throw new Error('Unsupported release lifecycle command');
    }
    try {
      const result = await execFileFn('gh', args, { env, shell: false, windowsHide: true,
        encoding: 'utf8', timeout: timeoutMs, maxBuffer: 2_097_152 });
      return { exitCode: 0, stdout: result.stdout };
    } catch {
      throw new Error('GitHub release lifecycle request failed or exceeded its limit');
    }
  };
}
