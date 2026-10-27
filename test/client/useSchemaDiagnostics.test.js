/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useSchemaDiagnostics } from '../../src/client/composables/useSchemaDiagnostics.js';
import { projectSchemaDiagnosticsPayload } from '../../src/client/lib/schema-diagnostics-presentation.js';

const payload = { schemaDiagnostics: { state: 'current', checkedAt: '2026-10-26T12:00:00Z', private: 'secret',
  lineage: { state: 'current', expectedRows: 115, observedRows: 115 },
  anchors: { state: 'current', checkedCount: 164, missingCount: 0, alteredCount: 0, sql: 'secret' } } };

test('schema diagnostics only load explicitly and suppress repeated activation during one request', async () => {
  const gate = Promise.withResolvers(); let calls = 0;
  const workflow = useSchemaDiagnostics({ fetchFn: async () => { calls++; return gate.promise; } });
  assert.equal(workflow.state.value, 'idle'); assert.equal(calls, 0);
  const first = workflow.refresh(); assert.equal(workflow.state.value, 'loading');
  await workflow.refresh(); assert.equal(calls, 1); gate.resolve(payload); await first;
  assert.equal(workflow.state.value, 'current'); assert.doesNotMatch(JSON.stringify(workflow.report.value), /secret|sql/u);
});

test('failed refresh clears previous current results and exposes fixed safe messages for retry and authorization errors', async () => {
  let failure;
  const workflow = useSchemaDiagnostics({ fetchFn: async () => { if (failure) throw failure; return payload; } });
  for (const [status, expected] of [[503, 'unavailable'], [401, 'forbidden'], [403, 'forbidden'], [429, 'limited']]) {
    failure = null; await workflow.refresh(); assert.equal(workflow.state.value, 'current');
    failure = Object.assign(new Error('private error'), { status }); await workflow.refresh();
    assert.equal(workflow.state.value, expected); assert.equal(workflow.report.value, null); assert.doesNotMatch(workflow.message.value, /private/u);
  }
});

test('unmount aborts the request and ignores even a late successful response', async () => {
  const gate = Promise.withResolvers(); let signal;
  const scope = effectScope(); const workflow = scope.run(() => useSchemaDiagnostics({ fetchFn: async options => { signal = options.signal; return gate.promise; } }));
  const pending = workflow.refresh(); scope.stop(); assert.equal(signal.aborted, true);
  gate.resolve(payload); await pending; assert.equal(workflow.report.value, null);
  await workflow.refresh(); assert.equal(workflow.state.value, 'loading');
});

test('unknown, malformed or contradictory schema payloads cannot display a current result', () => {
  for (const value of [null, {}, { schemaDiagnostics: { state: 'current' } },
    { schemaDiagnostics: { ...payload.schemaDiagnostics, anchors: { ...payload.schemaDiagnostics.anchors, missingCount: 1 } } },
    { schemaDiagnostics: { ...payload.schemaDiagnostics, lineage: { ...payload.schemaDiagnostics.lineage, state: 'not_current' } } }]) {
    assert.equal(projectSchemaDiagnosticsPayload(value).state, 'unavailable');
  }
  assert.deepEqual(projectSchemaDiagnosticsPayload({ schemaDiagnostics: { state: 'busy', secret: 'private' } }), { state: 'busy' });
});
