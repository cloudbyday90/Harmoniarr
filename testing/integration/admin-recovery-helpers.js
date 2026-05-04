/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createAdminRecoveryService } from '../../src/server/recovery/admin-recovery-service.js';
import {
  armCommand,
  cancelCommand,
  statusCommand,
} from '../../src/server/cli/recovery-commands.js';

export async function armBootstrapAdminRecovery(options = {}) {
  const adminRecoveryService = createAdminRecoveryService();
  return adminRecoveryService.armBootstrapAdminRecovery(options);
}

function createCliOutputCapture() {
  const stdout = [];
  const stderr = [];
  let exitCode = null;

  return {
    writeOutput({ exitCode: nextExitCode, jsonOutput, textError, textOutput }) {
      exitCode = nextExitCode;

      if (textError) {
        stderr.push(textError);
        return;
      }

      if (jsonOutput) {
        stdout.push(jsonOutput);
        return;
      }

      if (textOutput) {
        stdout.push(textOutput);
      }
    },
    toResult() {
      const stdoutText = stdout.join('\n');
      const stderrText = stderr.join('\n');
      let parsedJson = null;

      if (stdoutText.trim().startsWith('{')) {
        parsedJson = JSON.parse(stdoutText);
      }

      return {
        exitCode,
        parsedJson,
        stderr: stderrText,
        stdout: stdoutText,
      };
    },
  };
}

async function runCliCommand(commandFn, args = []) {
  const outputCapture = createCliOutputCapture();

  await commandFn({
    args,
    writeOutput: outputCapture.writeOutput,
  });

  return outputCapture.toResult();
}

export async function runArmBootstrapAdminRecoveryCli(args = []) {
  return runCliCommand(armCommand, args);
}

export async function runBootstrapAdminStatusCli(args = []) {
  return runCliCommand(statusCommand, args);
}

export async function runCancelBootstrapAdminRecoveryCli(args = []) {
  return runCliCommand(cancelCommand, args);
}
