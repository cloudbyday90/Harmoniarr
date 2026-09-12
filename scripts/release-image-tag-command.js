/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function createReleaseImageTagCommand({ execFileFn = promisify(execFile) } = {}) {
  return async function runCommand({ args, env }) {
    const valid = Array.isArray(args) && args.every((value) => typeof value === 'string')
      && args[0] === 'buildx' && args[1] === 'imagetools'
      && (args.length === 5 && args[2] === 'inspect' && args[3] === '--raw'
        || args.length === 7 && args[2] === 'create' && args[3] === '--prefer-index=false' && args[4] === '--tag');
    if (!valid) throw new Error('Only bounded manifest inspection and unchanged-manifest promotion are supported');
    try {
      const result = await execFileFn('docker', args, { env, shell: false, windowsHide: true,
        encoding: 'buffer', timeout: 120_000, maxBuffer: 4_194_304 });
      return { exitCode: 0, stdout: result.stdout };
    } catch {
      throw new Error('Registry image tag command failed or exceeded its limit');
    }
  };
}
