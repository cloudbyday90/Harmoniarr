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

import { parseArgs } from 'node:util';
import { createAdminRecoveryService } from '../recovery/admin-recovery-service.js';
import { closePool } from '../database.js';
import { writeAndExit } from './cli-runtime.js';
import { runRecoveryCommand } from './recovery-command-runtime.js';
import { formatArmResult, formatCancelResult, formatStatusResult } from './recovery-command-output.js';

const recoveryCommandOptions = {
  json: { type: 'boolean', default: false },
  reason: { type: 'string' },
  force: { type: 'boolean', default: false },
  'ttl-minutes': { type: 'string' },
};

function createRecoveryCommand(command, serviceMethod, formatResult) {
  return async ({
    args = process.argv.slice(2),
    recoveryService = createAdminRecoveryService(),
    writeOutput = writeAndExit,
    cleanup = closePool,
  } = {}) => {
    // Preserve JSON refusal even when strict option parsing fails.
    const json = args.includes('--json');
    return runRecoveryCommand({
      command, json, cleanup, writeOutput,
      formatResult: result => formatResult(result, json),
      execute: async () => {
        let values;
        try {
          ({ values } = parseArgs({ args, options: recoveryCommandOptions, strict: true, allowPositionals: false }));
          if (values['ttl-minutes'] !== undefined && !/^[0-9]+$/u.test(values['ttl-minutes'])) throw new Error('Invalid TTL');
          if (values['ttl-minutes'] !== undefined && !Number.isSafeInteger(Number(values['ttl-minutes']))) throw new Error('Invalid TTL');
        } catch {
          throw Object.assign(new Error('Invalid recovery command options'), { code: 'RECOVERY_INVALID_ARGUMENT' });
        }
        return recoveryService[serviceMethod]({
          force: values.force,
          reason: values.reason ?? undefined,
          ttlMinutes: values['ttl-minutes'] === undefined ? undefined : Number(values['ttl-minutes']),
        });
      },
    });
  };
}

export const armCommand = createRecoveryCommand('arm-bootstrap-admin', 'armBootstrapAdminRecovery', formatArmResult);
export const statusCommand = createRecoveryCommand('bootstrap-admin-status', 'getBootstrapAdminRecoveryStatus', formatStatusResult);
export const cancelCommand = createRecoveryCommand('cancel-bootstrap-admin', 'cancelBootstrapAdminRecovery', formatCancelResult);

export const recoveryCommands = Object.freeze({
  'arm-bootstrap-admin': armCommand,
  'bootstrap-admin-status': statusCommand,
  'cancel-bootstrap-admin': cancelCommand,
});
