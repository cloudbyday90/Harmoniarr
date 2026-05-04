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

export function createOperationRunCancellationError({
  message = 'Operation run cancelled by operator',
  runId,
} = {}) {
  const error = new Error(message);
  error.code = 'operation_run_cancelled';
  error.runId = runId ?? null;
  return error;
}

export function createOperationRunPauseError({
  message = 'Operation run paused due to an active maintenance lock',
  nextRetryAt = null,
  pauseCode = null,
  pauseProvider = null,
  runId,
} = {}) {
  const error = new Error(message);
  error.code = 'operation_run_paused';
  error.nextRetryAt = nextRetryAt;
  error.pauseCode = pauseCode;
  error.pauseProvider = pauseProvider;
  error.runId = runId ?? null;
  return error;
}

export function isOperationRunCancellationError(error) {
  return error?.code === 'operation_run_cancelled';
}

export function isOperationRunPauseError(error) {
  return error?.code === 'operation_run_paused';
}

export function createOperationRunInterruptionGate({
  isCancellationRequested = async () => false,
  operationLabel,
  operationPauseService = null,
} = {}) {
  return async function checkOperationRunInterruption({ runId } = {}) {
    if (await isCancellationRequested({ runId })) {
      return true;
    }

    if (!operationPauseService?.resolveOperationReadiness) {
      return false;
    }

    const readiness = await operationPauseService.resolveOperationReadiness({ operationLabel });
    if (readiness?.allowed !== false) {
      return false;
    }

    return {
      kind: 'paused',
      nextRetryAt: readiness.nextRetryAt ?? null,
      pauseCode: readiness.pauseCode ?? null,
      pauseMessage: readiness.pauseMessage ?? null,
      pauseProvider: readiness.pauseProvider ?? null,
    };
  };
}

export async function throwIfOperationRunCancellationRequested({
  isCancellationRequested,
  runId,
} = {}) {
  if (!isCancellationRequested) {
    return;
  }

  const interruption = await isCancellationRequested({ runId });
  if (interruption === true) {
    throw createOperationRunCancellationError({ runId });
  }

  if (interruption && typeof interruption === 'object' && interruption.kind === 'paused') {
    throw createOperationRunPauseError({
      message: interruption.pauseMessage,
      nextRetryAt: interruption.nextRetryAt,
      pauseCode: interruption.pauseCode,
      pauseProvider: interruption.pauseProvider,
      runId,
    });
  }
}