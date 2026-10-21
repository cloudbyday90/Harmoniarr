/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { describeRecoveryError, exitCodes, formatJsonError, getRecoveryExitCode, recoveryReviewGuidance } from './cli-runtime.js';

/** Own execution, one result delivery, and exactly one cleanup attempt. */
export async function runRecoveryCommand({ command, execute, formatResult, json, cleanup, writeOutput }) {
  const failures = [];
  let operationSucceeded = false;
  let outputDelivered = false;
  let result;
  let exitCode = exitCodes.success;
  try {
    result = await execute();
    operationSucceeded = true;
  } catch (error) {
    failures.push({ stage: 'operation', error });
    exitCode = getRecoveryExitCode(error?.code);
  }

  try {
    const output = operationSucceeded ? formatResult(result) : json
      ? { jsonOutput: formatJsonError({ command, error: failures[0].error }) }
      : { textError: `Error: ${describeRecoveryError(failures[0].error).message}` };
    await writeOutput({ ...output, exitCode });
    outputDelivered = true;
  } catch (error) {
    failures.push({ stage: 'output', error });
    if (operationSucceeded) exitCode = exitCodes.internalError;
  } finally {
    try { await cleanup(); }
    catch (error) {
      failures.push({ stage: 'cleanup', error });
      if (operationSucceeded) exitCode = exitCodes.internalError;
    }
  }

  if (failures.some(({ stage }) => stage !== 'operation')) {
    const state = operationSucceeded ? 'Recovery command completed.' : 'Recovery command did not return success.';
    const delivery = outputDelivered ? 'The result was handed to the output stream.' : 'Result delivery failed; output may be incomplete.';
    const cleanupState = failures.some(({ stage }) => stage === 'cleanup') ? ' Database cleanup failed.' : '';
    try {
      // Separate, bounded stderr only. Never replay a result or its secret.
      await writeOutput({ textError: `${state} ${delivery}${cleanupState} ${recoveryReviewGuidance}`, exitCode });
    } catch (error) { failures.push({ stage: 'diagnostic', error }); }
  }

  // Original Error/null remains private and ordered; no code/result is returned.
  return { exitCode, operationSucceeded, outputDelivered, failures };
}
