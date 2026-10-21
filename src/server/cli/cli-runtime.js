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

import { writeCliRecord } from './cli-output.js';

export const exitCodes = Object.freeze({
  success: 0,
  internalError: 1,
  invalidInput: 2,
  alreadyArmed: 3,
  prerequisiteFailed: 4,
});

const recoveryExitCodeMap = Object.freeze({
  RECOVERY_ALREADY_ARMED: exitCodes.alreadyArmed,
  RECOVERY_NOT_ARMED: exitCodes.invalidInput,
  RECOVERY_LOCK_CONFLICT: exitCodes.prerequisiteFailed,
  RECOVERY_DB_UNAVAILABLE: exitCodes.prerequisiteFailed,
  RECOVERY_INVALID_ARGUMENT: exitCodes.invalidInput,
  RECOVERY_FORCE_REQUIRED: exitCodes.invalidInput,
});

export function getRecoveryExitCode(errorCode) {
  return Object.hasOwn(recoveryExitCodeMap, errorCode) ? recoveryExitCodeMap[errorCode] : exitCodes.internalError;
}

export function formatJsonOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

const recoveryErrorMessages = Object.freeze({
  RECOVERY_ALREADY_ARMED: 'Bootstrap-admin recovery is already armed.',
  RECOVERY_NOT_ARMED: 'No active recovery run exists.',
  RECOVERY_LOCK_CONFLICT: 'Lock conflict: recovery is blocked by restore or upgrade activity.',
  RECOVERY_DB_UNAVAILABLE: 'The recovery database is unavailable. Check status before retrying a mutation.',
  RECOVERY_INVALID_ARGUMENT: 'Invalid recovery command options.',
  RECOVERY_FORCE_REQUIRED: 'Use --force to cancel an active recovery run.',
});

export const recoveryReviewGuidance = 'Check recovery bootstrap-admin-status before deciding whether to cancel or explicitly re-arm. Status cannot recover the code. Do not automatically retry.';

export function describeRecoveryError(error) {
  const code = error?.code;
  if (Object.hasOwn(recoveryErrorMessages, code)) return { code, message: recoveryErrorMessages[code] };
  return { code: 'RECOVERY_INTERNAL_ERROR', message: `Recovery command outcome could not be confirmed. ${recoveryReviewGuidance}` };
}

export function formatJsonError({ command, error }) {
  return formatJsonOutput({
    success: false,
    command,
    error: describeRecoveryError(error),
  });
}

export async function writeAndExit({
  exitCode = 0,
  jsonOutput = null,
  setExitCode = code => { process.exitCode = code; },
  stderr = process.stderr,
  stdout = process.stdout,
  textOutput = null,
  textError = null,
} = {}) {
  try {
    if (textError) {
      await writeCliRecord(stderr, `${textError}\n`);
    } else if (jsonOutput !== null) {
      await writeCliRecord(stdout, `${jsonOutput}\n`);
    } else if (textOutput !== null) {
      await writeCliRecord(stdout, `${textOutput}\n`);
    }
    setExitCode(exitCode);
  } catch (error) {
    setExitCode(exitCodes.internalError);
    throw error;
  }
}
