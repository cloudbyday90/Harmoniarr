/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { capturePostgresDiagnosticErrors, isCheckoutCorrelationId, readCheckoutProperty as read } from './pool-checkout-record.js';

const member = (value, allowed, fallback = 'unknown') => allowed.includes(value) ? value : fallback;
const duration = value => Number.isFinite(value) && value >= 0 && value <= 86_400_000 ? value : null;
const version = value => Number.isSafeInteger(value) && value >= 90000 && value <= 999999 ? value : null;
const boolean = value => typeof value === 'boolean' ? value : null;
const exitCode = value => Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
export function buildPostgresFailureRecord({ correlationId, source, phase, error, host, readiness, durationMs }) {
  return Object.freeze({ version: 1, kind: 'owned_server_failure',
    correlationId: isCheckoutCorrelationId(correlationId) ? correlationId : null,
    source: member(source, ['testcontainer_postgres', 'external_postgres']),
    phase: member(phase, ['schema_prepare', 'database_scenario']),
    errors: capturePostgresDiagnosticErrors(error), durationMs: duration(durationMs),
    host: Object.freeze({
      outcome: member(read(host, 'outcome'), ['passed', 'failed', 'unavailable']),
      stage: member(read(host, 'stage'), ['connect', 'query', 'close', 'not_owned', 'off', 'cancelled']),
      version: version(read(host, 'version')),
      recovery: boolean(read(host, 'recovery')),
      closed: boolean(read(host, 'closed')),
      errors: read(host, 'outcome') === 'failed' ? capturePostgresDiagnosticErrors(read(host, 'error')) : Object.freeze([]),
    }),
    readiness: Object.freeze({
      outcome: member(read(readiness, 'outcome'), ['accepting', 'unavailable', 'failed']),
      cliExitCode: exitCode(read(readiness, 'cliExitCode')),
      errors: read(readiness, 'outcome') === 'failed' ? capturePostgresDiagnosticErrors(read(readiness, 'error')) : Object.freeze([]),
    }),
  });
}
