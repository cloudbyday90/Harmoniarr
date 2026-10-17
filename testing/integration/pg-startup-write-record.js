/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { capturePostgresDiagnosticErrors, readCheckoutProperty as read } from './pool-checkout-record.js';

export function buildPgStartupWriteRecord(input) {
  const returned = read(input, 'returnOutcome'); const callback = read(input, 'callbackOutcome');
  const observation = read(input, 'observation'); const backpressure = read(input, 'backpressure');
  const returnOutcome = ['returned', 'threw'].includes(returned) ? returned : 'unknown';
  const callbackOutcome = ['pending', 'passed', 'failed'].includes(callback) ? callback : 'not_observed';
  const error = returnOutcome === 'threw' || callbackOutcome === 'failed'
    ? capturePostgresDiagnosticErrors({ code: read(input, 'errorCode'), name: read(input, 'errorClass') })[0] : null;
  return Object.freeze({ version: 1,
    observation: ['observed', 'unsupported_method', 'unsupported_packet', 'unsupported_stream', 'adapter_unavailable'].includes(observation)
      ? observation : 'not_observed',
    returnOutcome, callbackOutcome,
    backpressure: typeof backpressure === 'boolean' ? backpressure : null,
    ...Object.fromEntries(['attemptedMs', 'returnedMs', 'callbackMs'].map(key => {
      const value = read(input, key);
      return [key, Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : null];
    })),
    errorCode: error?.code ?? null, errorClass: error?.errorClass ?? null,
  });
}
