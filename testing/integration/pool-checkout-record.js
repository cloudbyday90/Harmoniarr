/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const codes = new Set(['ABORT_ERR', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN',
  'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID',
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01', '28000', '28P01',
  '3D000', '53300', '53400', '57P01', '57P02', '57P03']);
const classes = new Set(['Error', 'TypeError', 'RangeError', 'AggregateError', 'AbortError']);
const sources = new Set(['external_postgres', 'testcontainer_postgres']);

export function readCheckoutProperty(value, key) {
  try { return value?.[key]; } catch { return undefined; }
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}
function boolean(value) { return typeof value === 'boolean' ? value : null; }

function projectSnapshot(value) {
  return Object.freeze({
    total: integer(readCheckoutProperty(value, 'total')),
    idle: integer(readCheckoutProperty(value, 'idle')),
    waiting: integer(readCheckoutProperty(value, 'waiting')),
    max: integer(readCheckoutProperty(value, 'max')),
    connectionTimeoutMs: integer(readCheckoutProperty(value, 'connectionTimeoutMs')),
    ending: boolean(readCheckoutProperty(value, 'ending')),
    ended: boolean(readCheckoutProperty(value, 'ended')),
  });
}

export function capturePoolCheckoutSnapshot(pool) {
  const options = readCheckoutProperty(pool, 'options');
  return projectSnapshot({
    total: readCheckoutProperty(pool, 'totalCount'), idle: readCheckoutProperty(pool, 'idleCount'),
    waiting: readCheckoutProperty(pool, 'waitingCount'), max: readCheckoutProperty(options, 'max'),
    connectionTimeoutMs: readCheckoutProperty(options, 'connectionTimeoutMillis'),
    ending: readCheckoutProperty(pool, 'ending'), ended: readCheckoutProperty(pool, 'ended'),
  });
}

export function capturePostgresDiagnosticErrors(error) {
  const seen = new Set(); const result = [];
  let current = error;
  for (let depth = 0; depth < 3 && !seen.has(current); depth++) {
    seen.add(current);
    const code = readCheckoutProperty(current, 'code');
    const name = readCheckoutProperty(current, 'name');
    result.push(Object.freeze({ code: codes.has(code) ? code : null,
      errorClass: classes.has(name) ? name : null }));
    const cause = readCheckoutProperty(current, 'cause');
    if (cause === undefined) break;
    current = cause;
  }
  return Object.freeze(result);
}

export function isCheckoutCorrelationId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}

export function buildPoolCheckoutRecord({ correlationId, source, serverPhase, outcome,
  before, requested, settled, durationMs, error }) {
  return Object.freeze({ version: 1, kind: 'first_app_checkout',
    correlationId: isCheckoutCorrelationId(correlationId) ? correlationId : null,
    phase: 'schema_prepare', source: sources.has(source) ? source : 'unknown',
    lastServerPhase: serverPhase === 'isolated_database_admitted' ? serverPhase : 'unknown',
    outcome: ['started', 'passed', 'failed'].includes(outcome) ? outcome : 'unknown',
    before: projectSnapshot(before), requested: projectSnapshot(requested), settled: projectSnapshot(settled),
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= 86_400_000 ? durationMs : null,
    errors: outcome === 'failed' ? capturePostgresDiagnosticErrors(error) : Object.freeze([]),
  });
}
