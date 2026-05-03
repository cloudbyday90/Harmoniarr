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
  return recoveryExitCodeMap[errorCode] ?? exitCodes.internalError;
}

export function formatJsonOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

export function formatJsonError({ command, error }) {
  return formatJsonOutput({
    success: false,
    command,
    error: {
      code: error.code ?? 'RECOVERY_INTERNAL_ERROR',
      message: error.message ?? 'Unexpected error',
    },
  });
}

export function writeAndExit({
  exitCode = 0,
  jsonOutput = null,
  processExit = process.exit,
  stderr = process.stderr,
  stdout = process.stdout,
  textOutput = null,
  textError = null,
} = {}) {
  if (textError) {
    stderr.write(`${textError}\n`);
  } else if (jsonOutput !== null) {
    stdout.write(`${jsonOutput}\n`);
  } else if (textOutput !== null) {
    stdout.write(`${textOutput}\n`);
  }

  processExit(exitCode);
}
