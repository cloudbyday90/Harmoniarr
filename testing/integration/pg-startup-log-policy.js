/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isCheckoutCorrelationId, readCheckoutProperty as read } from './pool-checkout-record.js';

export const postgresStartupLogBytes = 65_536;
const markerPattern = /^hxi_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const namePattern = /^[a-zA-Z0-9_]{1,63}$/u;
const numeric = value => Number.isFinite(value) && value >= 0 && value <= 86_400_000;
export function capturePgStartupContext(input) {
  const marker = read(input, 'marker'); const clientId = read(input, 'clientId');
  const user = read(input, 'user'); const database = read(input, 'database');
  if (typeof marker !== 'string' || !markerPattern.test(marker) || !isCheckoutCorrelationId(clientId)
    || ![user, database].every(value => typeof value === 'string' && namePattern.test(value))) return null;
  return Object.freeze({ marker, clientId, user, database });
}

/** Classify only reviewed structured startup locations. Never retain a raw log row. */
function classify(row, context) {
  // jsonlog.c omits a zero SQLSTATE (00000) for ordinary LOG records.
  if (!row || !['client backend', 'not initialized'].includes(row.backend_type) || row.error_severity !== 'LOG'
    || (row.state_code !== undefined && row.state_code !== '00000')
    || !Number.isSafeInteger(row.pid) || row.pid <= 0 || row.pid > 2_147_483_647
    || typeof row.session_id !== 'string' || !/^[a-f0-9]{1,16}\.[a-f0-9]{1,16}$/u.test(row.session_id)
    || !Number.isSafeInteger(row.line_num) || row.line_num < 1 || row.line_num > 1_000_000
    || typeof row.message !== 'string' || row.message.length > 2048) return null;
  let stage; let timings;
  if (row.file_name === 'backend_startup.c' && row.func_name === 'BackendInitialize'
    && /^connection received: host=[a-zA-Z0-9.:_%/-]+(?: port=[0-9]{1,5})?$/u.test(row.message)) stage = 'receipt';
  // Receipt precedes backend-type initialization; later stages must identify a client backend.
  if (row.backend_type === 'not initialized' && stage !== 'receipt') return null;
  if (row.file_name === 'auth.c' && ['set_authn_id', 'ClientAuthentication'].includes(row.func_name)
    && row.message.startsWith('connection authenticated: ')) stage = 'authentication';
  if (row.file_name === 'postinit.c' && row.func_name === 'PerformAuthentication'
    && row.user === context.user && row.dbname === context.database
    && row.message === `connection authorized: user=${context.user} database=${context.database} application_name=${context.marker}`) stage = 'authorization';
  if (row.file_name === 'postgres.c' && row.func_name === 'PostgresMain' && row.application_name === context.marker) {
    const match = /^connection ready: setup total=([0-9]{1,9}\.[0-9]{3}) ms, fork=([0-9]{1,9}\.[0-9]{3}) ms, authentication=([0-9]{1,9}\.[0-9]{3}) ms$/u.exec(row.message);
    if (match) {
      const [setupTotalMs, forkMs, authenticationMs] = match.slice(1).map(Number);
      if ([setupTotalMs, forkMs, authenticationMs].every(numeric)) {
        stage = 'ready'; timings = { setupTotalMs, forkMs, authenticationMs };
      }
    }
  }
  return stage ? { key: `${row.pid}:${row.session_id}`, line: row.line_num, stage, timings } : null;
}

export function readPgStartupLogWindow(stdout, context) {
  const captured = capturePgStartupContext(context);
  if (typeof stdout !== 'string' || Buffer.byteLength(stdout) > postgresStartupLogBytes || !captured) {
    return { outcome: 'unavailable' };
  }
  const records = []; let clipped = Buffer.byteLength(stdout) === postgresStartupLogBytes; let parsed = 0;
  for (const line of stdout.split('\n')) {
    if (!line) continue;
    if (++parsed > 256) { clipped = true; break; }
    if (Buffer.byteLength(line) > 4096) { clipped = true; continue; }
    try { const record = classify(JSON.parse(line), captured); if (record) records.push(record); }
    catch { clipped = true; } // A bounded tail may begin/end inside a JSON row.
  }
  const windows = { receiptRowsInWindow: records.filter(r => r.stage === 'receipt').length, clipped };
  const authorization = records.filter(r => r.stage === 'authorization');
  if (authorization.length !== 1) return { ...windows, outcome: authorization.length ? 'ambiguous' : 'unassociated' };
  const selected = records.filter(r => r.key === authorization[0].key).sort((a, b) => a.line - b.line);
  if (new Set(selected.map(r => r.line)).size !== selected.length) return { ...windows, outcome: 'ambiguous' };
  const order = ['receipt', 'authentication', 'authorization', 'ready'];
  if (selected.some((r, i) => i && order.indexOf(r.stage) <= order.indexOf(selected[i - 1].stage))) return { ...windows, outcome: 'ambiguous' };
  const ready = selected.find(r => r.stage === 'ready');
  return { ...windows, outcome: 'associated', clientId: captured.clientId,
    lastStage: selected.at(-1).stage, receiptObserved: selected.some(r => r.stage === 'receipt'),
    authenticationObserved: selected.some(r => r.stage === 'authentication'), authorizationObserved: true,
    readyObserved: Boolean(ready), ...(ready?.timings ?? {}) };
}
