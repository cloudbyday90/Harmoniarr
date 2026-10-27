/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchemaDiagnosticsService } from '../../src/server/schema-diagnostics-service.js';

const report = { current: true, private: 'private marker', lineage: { state: 'current', expectedRows: 115, observedRows: 115,
  pendingCount: 0, unknownAppliedCount: 0, checksumDriftCount: 0, migrationKeyDriftCount: 0, nonAppliedCount: 0, rawSql: 'private marker' },
anchors: { state: 'current', checkedCount: 164, missing: [], altered: [], definition: 'private marker' } };

test('HTTP diagnostics project counts and completion time while discarding raw identities, definitions and errors', async () => {
  const service = createSchemaDiagnosticsService({ inspectFn: async () => report, now: () => new Date('2026-10-26T12:00:00Z') });
  const result = await service.getSchemaDiagnostics();
  assert.equal(result.state, 'current'); assert.equal(result.checkedAt, '2026-10-26T12:00:00.000Z');
  assert.equal(result.anchors.checkedCount, 164); assert.equal(result.lineage.pendingCount, 0);
  assert.doesNotMatch(JSON.stringify(result), /private|rawSql|definition|missing"|altered"/u);
});

test('the per-process diagnostic admission has one active scan and no queued callers or retained result', async () => {
  const started = Promise.withResolvers(), release = Promise.withResolvers(); let calls = 0;
  const service = createSchemaDiagnosticsService({ inspectFn: async () => { calls++; started.resolve(); await release.promise; return report; } });
  const first = service.getSchemaDiagnostics(); await started.promise;
  try {
    const result = await Promise.all(Array.from({ length: 8 }, () => service.getSchemaDiagnostics()));
    assert.ok(result.every(row => row.state === 'busy' && row.checkedAt === null)); assert.equal(calls, 1);
  } finally { release.resolve(); await first; }
  assert.equal((await service.getSchemaDiagnostics()).state, 'current'); assert.equal(calls, 2);
});

test('busy, Error/null, malformed and inconsistent results fail safely and release admission for retry', async () => {
  for (const failure of [new Error('private credentials'), null, { code: 'schema_observation_busy' }]) {
    let fail = true;
    const service = createSchemaDiagnosticsService({ inspectFn: async () => { if (fail) throw failure; return report; } });
    const result = await service.getSchemaDiagnostics(); assert.equal(result.state, failure?.code ? 'busy' : 'unavailable');
    assert.equal(result.lineage, null); assert.doesNotMatch(JSON.stringify(result), /private|credentials/u);
    fail = false; assert.equal((await service.getSchemaDiagnostics()).state, 'current');
  }
  for (const value of [null, {}, { ...report, anchors: { ...report.anchors, checkedCount: -1 } },
    { ...report, anchors: { ...report.anchors, missing: ['private name'] } }]) {
    const service = createSchemaDiagnosticsService({ inspectFn: async () => value });
    assert.equal((await service.getSchemaDiagnostics()).state, 'unavailable');
  }
});

test('lineage attention and critical drift remain distinct summary axes with incomplete counts identified', async () => {
  const service = createSchemaDiagnosticsService({ inspectFn: async () => ({ ...report, current: false,
    lineage: { state: 'not_current', reason: 'row_limit_exceeded', expectedRows: 115, observedRows: 116 },
    anchors: { state: 'drift', checkedCount: 164, missing: ['private name'], altered: ['private definition'] } }) });
  const result = await service.getSchemaDiagnostics();
  assert.equal(result.state, 'attention'); assert.equal(result.lineage.incomplete, true);
  assert.equal(result.anchors.missingCount, 1); assert.equal(result.anchors.alteredCount, 1);
  assert.doesNotMatch(JSON.stringify(result), /private/u);
});
