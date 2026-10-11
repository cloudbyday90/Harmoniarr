/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readCheckoutProperty } from './pool-checkout-record.js';

const executeFile = promisify(execFile);
export const isOwnedContainerId = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
/** Read only the captured immutable container; never discovers or mutates resources. */
export function createPostgresReadinessProbe({ containerId, user = 'harmoniarr', database = 'postgres', executeFileFn = executeFile }) {
  if (!isOwnedContainerId(containerId)) throw new TypeError('A captured container identity is required');
  if (![user, database].every(value => typeof value === 'string' && /^[a-zA-Z0-9_]{1,63}$/u.test(value))) {
    throw new TypeError('Readiness requires captured simple fixture names');
  }
  const args = Object.freeze(['exec', containerId, 'pg_isready', '-q', '-t', '1',
    '-h', '127.0.0.1', '-p', '5432', '-U', user, '-d', database]);
  return async () => {
    try {
      await executeFileFn('docker', [...args], { shell: false, windowsHide: true,
        timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 512 });
    } catch (error) {
      const code = readCheckoutProperty(error, 'code');
      return { outcome: 'failed', cliExitCode: Number.isInteger(code) && code >= 1 && code <= 255 ? code : null, error };
    }
    return { outcome: 'accepting', cliExitCode: 0 };
  };
}
