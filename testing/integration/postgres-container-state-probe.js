/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isOwnedContainerId } from './postgres-readiness-probe.js';

const executeFile = promisify(execFile);
export const postgresContainerStateFormat = '[{{.State.Running}},{{.State.Paused}},{{.State.Restarting}},{{.State.OOMKilled}},{{.State.ExitCode}},{{.RestartCount}}]';
const invalidResponse = () => Object.assign(new Error('Invalid bounded container state'), { code: 'fixture_container_state_invalid' });

/** Read a captured fresh container only; never retrieve configuration, paths or logs. */
export function createPostgresContainerStateProbe({ containerId, executeFileFn = executeFile }) {
  if (!isOwnedContainerId(containerId)) throw new TypeError('A captured container identity is required');
  return async () => {
    try {
      const { stdout } = await executeFileFn('docker', ['container', 'inspect', '--format', postgresContainerStateFormat, containerId], {
        shell: false, windowsHide: true, timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 512,
      });
      if (typeof stdout !== 'string' || stdout.length > 512) throw invalidResponse();
      const values = JSON.parse(stdout);
      if (!Array.isArray(values) || values.length !== 6
        || !values.slice(0, 4).every(value => typeof value === 'boolean')
        || !Number.isInteger(values[4]) || values[4] < 0 || values[4] > 255
        || !Number.isSafeInteger(values[5]) || values[5] < 0) throw invalidResponse();
      const [running, paused, restarting, oomKilled, exitCode, restartCount] = values;
      return { outcome: 'passed', running, paused, restarting, oomKilled, exitCode, restartCount };
    } catch (error) { return { outcome: 'failed', error }; }
  };
}
