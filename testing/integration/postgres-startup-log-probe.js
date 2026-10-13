/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isOwnedContainerId } from './postgres-readiness-probe.js';
import { postgresStartupLogBytes, readPgStartupLogWindow, capturePgStartupContext } from './pg-startup-log-policy.js';
import { buildPgStartupServerRecord } from './pg-startup-server-record.js';

const executeFile = promisify(execFile);
const command = 'test -f "$PGDATA/log/harmoniarr-startup.json" && exec tail -c 65536 "$PGDATA/log/harmoniarr-startup.json"';
export function createPostgresStartupLogProbe({ containerId, context, executeFileFn = executeFile }) {
  const captured = capturePgStartupContext(context);
  if (!isOwnedContainerId(containerId) || !captured) throw new TypeError('Startup probe requires an owned identity/context');
  return async () => {
    try {
      const { stdout } = await executeFileFn('docker', ['exec', containerId, 'sh', '-c', command], {
        shell: false, windowsHide: true, timeout: 2000, killSignal: 'SIGKILL', maxBuffer: postgresStartupLogBytes + 1024,
      });
      return buildPgStartupServerRecord(readPgStartupLogWindow(stdout, captured));
    } catch { return buildPgStartupServerRecord({ outcome: 'failed' }); }
  };
}
