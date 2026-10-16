/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { createIntegrationTestEnvironment } from '../../testing/integration/integration-test-environment.js';
import { runIntegrationTests } from '../../testing/integration/integration-test-coordinator.js';
import { runIntegrationTestFile } from '../../testing/integration/integration-test-file.js';
import { sharedPostgresTestCohort } from '../../testing/integration/postgres-test-cohort.js';
import { cohortEvidenceMarker, createCohortPhases } from '../../testing/integration/postgres-cohort-evidence.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const sink = () => new Writable({ write(_chunk, _encoding, callback) { callback(); } });
function result() {
  return { exitCode: 0, signal: null, durationMs: 1, evidence: { version: 1, success: true, caseEvents: 2,
    caseDigest: 'a'.repeat(64), phases: createCohortPhases(),
    counts: { tests: 2, suites: 0, passed: 2, failed: 0, cancelled: 0, skipped: 0, todo: 0, topLevel: 2 } } };
}
function fixture() {
  const files = [...sharedPostgresTestCohort, 'test/integration/zz.test.js', 'test/integration/za.test.js'];
  const calls = []; const updates = [];
  const options = { env: { PATH: process.env.PATH, PGPASSWORD: 'external-private-canary', NODE_OPTIONS: '--private-canary' },
    stdout: sink(), stderr: sink(), discoverFiles: async () => files,
    preflight: async ({ env }) => ({ env, evidence: { controlled: true } }),
    onUpdate: async report => { updates.push(report); }, runFile: async input => { calls.push(input); return result(); },
    runShared: async ({ resolveFiles, runFile, env, ...rest }) => {
      for (const file of await resolveFiles()) await runFile({ ...rest, file, env: { ...env, PGPASSWORD: 'parent-private-canary' } });
      return { files: 7, completed: 7, registered: 131, released: 131, reaped: 0 };
    } };
  return { files, calls, updates, options };
}

test('environment removes case-variant database/parent/startup authority and snapshots retained settings without mutation', () => {
  const env = { pgpassword: 'private', POSTGRES_HOST: 'private', harmoniarr_test_pg_token: 'private',
    Node_Options: 'private', node_test_context: 'private', testcontainers_reuse_enable: 'true',
    harmoniarr_integration_use_container_reuse: 'true', PATH: 'retained',
    HARMONIARR_INTEGRATION_POSTGRES_IMAGE: 'retained-image', HARMONIARR_INTEGRATION_PG_POOL_MAX: '2' };
  const snapshot = createIntegrationTestEnvironment(env);
  assert.deepEqual(snapshot, { PATH: 'retained', HARMONIARR_INTEGRATION_POSTGRES_IMAGE: 'retained-image',
    HARMONIARR_INTEGRATION_PG_POOL_MAX: '2', TESTCONTAINERS_REUSE_ENABLE: 'false', HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE: 'false' });
  assert.equal(Object.isFrozen(snapshot), true); assert.equal(env.pgpassword, 'private');
  env.PATH = 'changed'; assert.equal(snapshot.PATH, 'retained');
  assert.throws(() => createIntegrationTestEnvironment({ OTHER: {} }), TypeError);
});

test('coordinator runs one reviewed shared step then every isolated file exactly once with private copied environments', async () => {
  const f = fixture(); const report = await runIntegrationTests(f.options);
  assert.equal(report.complete, true); assert.equal(report.failed, false); assert.equal(report.completed, 9);
  assert.equal(report.counts.tests, 18); assert.deepEqual(report.ownership, { registered: 131, released: 131, reaped: 0 });
  assert.deepEqual(report.outcomes.map(row => row.file), [...sharedPostgresTestCohort, 'test/integration/za.test.js', 'test/integration/zz.test.js']);
  assert.equal(new Set(f.calls.map(input => input.file)).size, f.files.length);
  assert.equal(f.calls.slice(0, 7).every(input => input.env.PGPASSWORD === 'parent-private-canary'), true);
  assert.equal(f.calls.slice(7).every(input => !Object.hasOwn(input.env, 'PGPASSWORD') && !Object.hasOwn(input.env, 'NODE_OPTIONS')), true);
  assert.notEqual(f.calls[7].env, f.calls[8].env);
  assert.equal(JSON.stringify(f.updates).includes('private-canary'), false);
  f.updates[0].counts.tests = 999; assert.equal(report.counts.tests, 18);
});

test('held shared cleanup prevents completed publication and admission of isolated files', async t => {
  const f = fixture(); const entered = createFixtureGate(); const hold = createFixtureGate(); const shared = f.options.runShared;
  f.options.runShared = async options => { const value = await shared(options); entered.release(); await hold.promise; return value; };
  const pending = runIntegrationTests(f.options);
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    assert.equal(f.calls.length, 7); assert.equal(f.updates.at(-1).completed, 0);
    hold.release(); assert.equal((await pending).complete, true);
  } finally { hold.release(); await pending; }
});

test('held progress prevents next-file admission and cancellation cannot publish a successful return', async t => {
  const f = fixture(); const entered = createFixtureGate(); const hold = createFixtureGate(); const controller = new AbortController();
  f.options.onUpdate = async report => { f.updates.push(report); if (report.completed === 7) { entered.release(); await hold.promise; } };
  const pending = runIntegrationTests({ ...f.options, signal: controller.signal }); pending.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    assert.equal(f.calls.length, 7); controller.abort(null); hold.release();
    await assert.rejects(pending, error => error === null); assert.equal(f.calls.length, 7);
    assert.equal(f.updates.at(-1).failed, true); assert.equal(f.updates.at(-1).complete, false);
  } finally { hold.release(); await pending.catch(() => {}); }
});

test('cancellation during the final progress callback refuses an otherwise complete return', async () => {
  const f = fixture(); const controller = new AbortController();
  f.options.onUpdate = async report => { f.updates.push(report); if (report.complete) controller.abort(null); };
  await assert.rejects(runIntegrationTests({ ...f.options, signal: controller.signal }), error => error === null);
  assert.equal(f.calls.length, 9); assert.equal(f.updates.at(-1).complete, false); assert.equal(f.updates.at(-1).failed, true);
});

test('cancellation during held shared cleanup awaits actual owner return before refusing later admission', async t => {
  const f = fixture(); const entered = createFixtureGate(); const hold = createFixtureGate(); const shared = f.options.runShared;
  const controller = new AbortController(); let settled = false;
  f.options.runShared = async options => { const value = await shared(options); entered.release(); await hold.promise; return value; };
  const pending = runIntegrationTests({ ...f.options, signal: controller.signal });
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    controller.abort(null); await Promise.resolve(); assert.equal(settled, false); assert.equal(f.calls.length, 7);
    hold.release(); await assert.rejects(pending, error => error === null); assert.equal(f.calls.length, 7);
  } finally { hold.release(); await observed; }
});

for (const primary of [new Error('Controlled owner failure'), null]) {
  test(`native Error/null remains primary over failure sink and prevents later admission (${primary === null ? 'null' : 'Error'})`, async () => {
    const f = fixture(); f.options.runFile = async input => { f.calls.push(input); throw primary; };
    f.options.onUpdate = async report => { if (report.failed) throw new Error('Secondary sink'); };
    await assert.rejects(runIntegrationTests(f.options), error => error === primary); assert.equal(f.calls.length, 1);
    const pre = fixture(); const controller = new AbortController(); controller.abort(primary);
    pre.options.discoverFiles = () => assert.fail('Pre-aborted discovery');
    await assert.rejects(runIntegrationTests({ ...pre.options, signal: controller.signal }), error => error === primary);
  });
}

for (const fault of ['missing', 'duplicate', 'unreleased', 'reaped', 'partial']) {
  test(`shared ${fault} ownership refuses success and isolated admission`, async () => {
    const f = fixture(); const shared = f.options.runShared;
    f.options.runShared = async options => {
      if (fault === 'missing') return { files: 7, completed: 7, registered: 131, released: 131, reaped: 0 };
      if (fault === 'duplicate') {
        const [file] = await options.resolveFiles(); await options.runFile({ file, env: {} }); return options.runFile({ file, env: {} });
      }
      const value = await shared(options);
      return { ...value, ...(fault === 'unreleased' ? { released: 130 } : fault === 'reaped' ? { reaped: 1 } : { completed: 6 }) };
    };
    await assert.rejects(runIntegrationTests(f.options), { code: 'fixture_integration_coverage_refused' });
    assert.equal(f.calls.length <= 7, true); assert.equal(f.updates.at(-1).complete, false); assert.equal(f.updates.at(-1).completed, 0);
  });
}

test('incomplete discovery refuses before any owner allocation', async () => {
  const f = fixture(); f.options.discoverFiles = async () => f.files.slice(1);
  f.options.runShared = () => assert.fail('Invalid discovery allocated a server');
  await assert.rejects(runIntegrationTests(f.options), { code: 'fixture_integration_coverage_refused' });
  assert.deepEqual(f.calls, []); assert.deepEqual(f.updates, []);
});

for (const primary of [new Error('Controlled prerequisite failure'), null]) {
  test(`preflight ${primary === null ? 'null' : 'Error'} refuses all PostgreSQL/file admission`, async () => {
    const f = fixture(); f.options.preflight = async () => { throw primary; };
    f.options.runShared = () => assert.fail('Prerequisite failure admitted PostgreSQL');
    await assert.rejects(runIntegrationTests(f.options), error => error === primary);
    assert.deepEqual(f.calls, []); assert.equal(f.updates.at(-1).failed, true); assert.equal(f.updates.at(-1).completed, 0);
  });
}

test('resolved prerequisite settings reach every child without inherited database authority', async () => {
  const f = fixture(); const image = 'postgres:18-alpine@sha256:' + 'd'.repeat(64);
  f.options.preflight = async ({ env }) => ({ env: { ...env, HARMONIARR_INTEGRATION_POSTGRES_IMAGE: image,
    PGPASSWORD: 'preflight-private-canary' }, evidence: { controlled: true } });
  const report = await runIntegrationTests(f.options);
  assert.equal(f.calls.every(input => input.env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE === image), true);
  assert.equal(f.calls.slice(7).every(input => !Object.hasOwn(input.env, 'PGPASSWORD')), true);
  assert.equal(JSON.stringify(report).includes('private-canary'), false);
});

test('held preflight and cancellation prevent database admission until actual return', async t => {
  const f = fixture(); const entered = createFixtureGate(); const hold = createFixtureGate(); const controller = new AbortController();
  f.options.preflight = async ({ env }) => { entered.release(); await hold.promise; return { env, evidence: {} }; };
  f.options.runShared = () => assert.fail('Cancelled preflight admitted PostgreSQL');
  const pending = runIntegrationTests({ ...f.options, signal: controller.signal }); pending.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    assert.deepEqual(f.calls, []); assert.deepEqual(f.updates, []); controller.abort(null); hold.release();
    await assert.rejects(pending, error => error === null); assert.deepEqual(f.calls, []);
  } finally { hold.release(); await pending.catch(() => {}); }
});

test('real native process evidence records all cases and refuses prerequisite skips', async () => {
  const file = resolve('testing/fixtures/postgres-cohort-reporter-fixture.js');
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  const value = await runIntegrationTestFile({ file, env: { ...env, COHORT_CONTROL_SKIP: '0' }, stdout: sink(), stderr: sink() });
  assert.equal(value.evidence.counts.tests, 2); assert.equal(value.evidence.counts.skipped, 0); assert.equal(value.evidence.caseEvents, 3);
  await assert.rejects(runIntegrationTestFile({ file, env: { ...env, COHORT_CONTROL_SKIP: '1' }, stdout: sink(), stderr: sink() }),
    { code: 'fixture_cohort_evidence_refused' });
});

for (const fault of ['missing', 'duplicate', 'malformed', 'skipped', 'exit', 'signal']) {
  test(`file evidence ${fault} cannot be accepted as complete native coverage`, async () => {
    const runFile = async ({ stderr }) => {
      let evidence = result().evidence;
      if (fault === 'skipped') evidence.counts.skipped = 1;
      const line = cohortEvidenceMarker + (fault === 'malformed' ? '{' : JSON.stringify(evidence)) + '\n';
      if (fault !== 'missing') for (let index = 0; index < (fault === 'duplicate' ? 2 : 1); index++) {
        await new Promise((resolveWrite, rejectWrite) => {
          stderr.write(line, error => { if (error) rejectWrite(error); else resolveWrite(); });
        });
      }
      return { exitCode: fault === 'exit' ? 1 : 0, signal: fault === 'signal' ? 'SIGTERM' : null, durationMs: 1 };
    };
    await assert.rejects(runIntegrationTestFile({ stderr: sink(), runFile }));
  });
}

test('file wrapper preserves original Error/null and forwards actual parent cancellation callbacks', async () => {
  for (const primary of [new Error('Controlled native failure'), null]) {
    const onCancel = () => {}; const onTermination = () => {};
    await assert.rejects(runIntegrationTestFile({ stderr: sink(), onCancel, onTermination, runFile: async options => {
      assert.equal(options.onCancel, onCancel); assert.equal(options.onTermination, onTermination);
      assert.equal(options.cohortEvidence, true); throw primary;
    } }), error => error === primary);
  }
});
