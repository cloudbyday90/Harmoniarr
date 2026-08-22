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

function isAbortSignal(value) {
  return value != null
    && typeof value === 'object'
    && typeof value.aborted === 'boolean'
    && typeof value.addEventListener === 'function'
    && typeof value.removeEventListener === 'function';
}

function createAbortError() {
  const error = new Error('Provider request was aborted');
  error.name = 'AbortError';
  return error;
}

export function normalizeProviderRequestSignal(signal) {
  if (signal == null) {
    return null;
  }

  if (!isAbortSignal(signal)) {
    throw new Error('provider request signal must be an AbortSignal');
  }

  return signal;
}

export function getProviderRequestAbortReason(signal) {
  const normalizedSignal = normalizeProviderRequestSignal(signal);
  return normalizedSignal?.reason ?? createAbortError();
}

export function throwIfProviderRequestAborted(signal) {
  const normalizedSignal = normalizeProviderRequestSignal(signal);
  if (normalizedSignal?.aborted) {
    throw getProviderRequestAbortReason(normalizedSignal);
  }
}

/**
 * Combines a client request timeout with an optional caller-owned deadline.
 * The caller signal is never supplied by a browser request; it is an internal
 * service policy boundary such as the related-artists response budget.
 */
export function createProviderRequestSignal({ signal = null, timeoutMs }) {
  const normalizedSignal = normalizeProviderRequestSignal(signal);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return normalizedSignal
    ? AbortSignal.any([normalizedSignal, timeoutSignal])
    : timeoutSignal;
}

/**
 * Allows a caller to stop waiting while retaining the queue's eventual
 * settlement. Queue execution must separately check the same signal before it
 * performs work, preventing an expired caller from starting a later request.
 */
export function awaitProviderRequest(promise, { signal = null } = {}) {
  const normalizedSignal = normalizeProviderRequestSignal(signal);
  if (!normalizedSignal) {
    return promise;
  }

  if (normalizedSignal.aborted) {
    return Promise.reject(getProviderRequestAbortReason(normalizedSignal));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    function finish(callback, value) {
      if (settled) {
        return;
      }

      settled = true;
      normalizedSignal.removeEventListener('abort', onAbort);
      callback(value);
    }

    function onAbort() {
      finish(reject, getProviderRequestAbortReason(normalizedSignal));
    }

    normalizedSignal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}

export function waitForProviderRequestDelay(delayMs, { signal = null, sleepImpl }) {
  const normalizedSignal = normalizeProviderRequestSignal(signal);
  if (normalizedSignal?.aborted) {
    return Promise.reject(getProviderRequestAbortReason(normalizedSignal));
  }

  return awaitProviderRequest(
    Promise.resolve().then(() => sleepImpl(delayMs)),
    { signal: normalizedSignal },
  );
}
