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
import {
  exitCodes,
  formatJsonError,
  formatJsonOutput,
  getRecoveryExitCode,
  writeAndExit,
} from './cli-runtime.js';

const recoveryCommandOptions = {
  json: { type: 'boolean', default: false },
  reason: { type: 'string' },
  force: { type: 'boolean', default: false },
  'ttl-minutes': { type: 'string' },
};

function parseRecoveryArgs(args) {
  return parseArgs({
    allowPositionals: true,
    args,
    options: recoveryCommandOptions,
    strict: true,
  });
}

function cleanup() {
  return closePool();
}

async function armCommand({
  args = process.argv.slice(2),
  recoveryService = createAdminRecoveryService(),
  writeOutput = writeAndExit,
} = {}) {
  const { values } = parseRecoveryArgs(args);
  const ttlMinutes = values['ttl-minutes']
    ? Number.parseInt(values['ttl-minutes'], 10)
    : undefined;

  try {
    const result = await recoveryService.armBootstrapAdminRecovery({
      force: values.force,
      reason: values.reason ?? undefined,
      ttlMinutes,
    });

    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonOutput({
          success: true,
          command: 'arm-bootstrap-admin',
          status: result.status,
          recoveryCode: result.recoveryCode,
          expiresAt: result.expiresAt,
          recoveryPath: '/recover/bootstrap-admin',
          replacedExistingRun: result.replacedExistingRun,
          warnings: [],
        }),
        exitCode: exitCodes.success,
      });
      return;
    }

    const lines = [
      'Bootstrap-admin recovery armed.',
      `Recovery code: ${result.recoveryCode}`,
      `Expires at: ${result.expiresAt}`,
      'Next step: open /recover/bootstrap-admin and complete recovery before expiry.',
    ];

    if (result.replacedExistingRun) {
      lines.unshift('Warning: previous armed recovery run was replaced.');
    }

    writeOutput({
      textOutput: lines.join('\n'),
      exitCode: exitCodes.success,
    });
  } catch (error) {
    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonError({ command: 'arm-bootstrap-admin', error }),
        exitCode: getRecoveryExitCode(error.code),
      });
      return;
    }

    writeOutput({
      textError: `Error: ${error.message}`,
      exitCode: getRecoveryExitCode(error.code),
    });
  }
}

async function statusCommand({
  args = process.argv.slice(2),
  recoveryService = createAdminRecoveryService(),
  writeOutput = writeAndExit,
} = {}) {
  const { values } = parseRecoveryArgs(args);

  try {
    const result = await recoveryService.getBootstrapAdminRecoveryStatus();

    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonOutput({
          success: true,
          command: 'bootstrap-admin-status',
          ...result,
          warnings: [],
        }),
        exitCode: exitCodes.success,
      });
      return;
    }

    if (!result.recoveryAvailable) {
      writeOutput({
        textOutput: 'No active recovery run.',
        exitCode: exitCodes.success,
      });
      return;
    }

    const lines = [
      'Bootstrap-admin recovery status:',
      `  Status: ${result.status}`,
      `  Expires at: ${result.expiresAt}`,
      `  Remaining attempts: ${result.remainingAttempts}`,
      `  Blocked by lock: ${result.blockedByLock ? 'yes' : 'no'}`,
    ];

    writeOutput({
      textOutput: lines.join('\n'),
      exitCode: exitCodes.success,
    });
  } catch (error) {
    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonError({ command: 'bootstrap-admin-status', error }),
        exitCode: getRecoveryExitCode(error.code),
      });
      return;
    }

    writeOutput({
      textError: `Error: ${error.message}`,
      exitCode: getRecoveryExitCode(error.code),
    });
  }
}

async function cancelCommand({
  args = process.argv.slice(2),
  recoveryService = createAdminRecoveryService(),
  writeOutput = writeAndExit,
} = {}) {
  const { values } = parseRecoveryArgs(args);

  try {
    const result = await recoveryService.cancelBootstrapAdminRecovery({
      force: values.force,
      reason: values.reason ?? undefined,
    });

    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonOutput({
          success: true,
          command: 'cancel-bootstrap-admin',
          status: result.status,
          cancelledAt: result.cancelledAt,
          warnings: [],
        }),
        exitCode: exitCodes.success,
      });
      return;
    }

    writeOutput({
      textOutput: `Bootstrap-admin recovery cancelled at ${result.cancelledAt}.`,
      exitCode: exitCodes.success,
    });
  } catch (error) {
    await cleanup();

    if (values.json) {
      writeOutput({
        jsonOutput: formatJsonError({ command: 'cancel-bootstrap-admin', error }),
        exitCode: getRecoveryExitCode(error.code),
      });
      return;
    }

    writeOutput({
      textError: `Error: ${error.message}`,
      exitCode: getRecoveryExitCode(error.code),
    });
  }
}

export const recoveryCommands = Object.freeze({
  'arm-bootstrap-admin': armCommand,
  'bootstrap-admin-status': statusCommand,
  'cancel-bootstrap-admin': cancelCommand,
});

export {
  armCommand,
  cancelCommand,
  statusCommand,
};
