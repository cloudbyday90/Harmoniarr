/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function createPublishedCandidateCommand({ execFileFn = promisify(execFile) } = {}) {
  return async function runTrustCommand({ command = 'gh', args, env, timeoutMs = 60_000 }) {
    const readOnly = Array.isArray(args) && args.every((value) => typeof value === 'string')
      && (args[0] === 'attestation' && args[1] === 'verify'
        || args[0] === 'api' && args.filter((value) => value === '--method').length === 1
          && args[args.indexOf('--method') + 1] === 'GET'
          && !args.some((value) => value === '-X' || value.startsWith('--method=')));
    if (command !== 'gh' || !readOnly) throw new Error('Published candidate trust only supports read-only GitHub verification');
    try {
      const result = await execFileFn('gh', args, {
        env, encoding: 'utf8', maxBuffer: 1_048_576, timeout: timeoutMs, shell: false, windowsHide: true,
      });
      return { exitCode: 0, stdout: result.stdout };
    } catch {
      // Registry errors and GitHub diagnostics can include credentials or URLs.
      throw Object.assign(new Error('Published candidate GitHub verification failed or exceeded its limit'), {
        code: 'published_candidate_trust_command_failed',
      });
    }
  };
}
