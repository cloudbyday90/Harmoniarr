/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { comparePostgresCohort } from '../../testing/integration/postgres-cohort-comparison.js';
import { createPostgresCohortEnvironment } from '../../testing/integration/postgres-cohort-policy.js';
import { cohortEvidenceMarker, createCohortLines, createCohortPhases, validateCohortFileEvidence } from '../../testing/integration/postgres-cohort-evidence.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const image = 'sha256:' + 'a'.repeat(64);
const environment = { HARMONIARR_INTEGRATION_POSTGRES_IMAGE: image, HARMONIARR_INTEGRATION_MEDIA_IMAGE: image };
function evidence() {
  const phases = createCohortPhases();
  for (const phase of ['database_create', 'database_drop', 'scenario_work']) phases[phase] = { count: 1, failed: 0, durationMs: 1 };
  return { version: 1, success: true, caseDigest: 'b'.repeat(64), caseEvents: 1,
    counts: { tests: 1, suites: 0, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0, topLevel: 1 }, phases };
}
function fixture() {
  const calls = []; const updates = []; let shared = false; let closing = false;
  const files = ['one', 'two', 'three', 'four', 'five'].map(name => resolve('test/integration/' + name + '.test.js'));
  const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const options = { env: environment, stdout: sink, stderr: sink, resolveFiles: async () => files,
    fingerprint: async () => ({ files: 1, sha256: 'controlled' }),
    onUpdate: async report => { assert.equal(closing, false); updates.push(report); },
    runFile: async ({ file, env, stderr, cohortEvidence }) => {
      assert.equal(cohortEvidence, true); assert.equal(env.HARMONIARR_INTEGRATION_PHASE_TIMINGS, '1'); calls.push(file);
      const record = evidence(); if (!shared) for (const name of ['container_start', 'container_stop']) {
        record.phases[name] = { count: 1, failed: 0, durationMs: 1 };
      }
      await new Promise((done, reject) => { stderr.write(cohortEvidenceMarker + JSON.stringify(record) + '\n', error => error ? reject(error) : done()); });
      return { exitCode: 0, signal: null, durationMs: 2 };
    },
    runShared: async ({ resolveFiles, runFile, env, createServer }) => {
      shared = true; const owner = await createServer({ env });
      try { for (const file of await resolveFiles()) await runFile({ file, env }); }
      finally { closing = true; await owner.close(); closing = false; shared = false; }
      return { files: 5, completed: 5, registered: 5, released: 5, reaped: 0 };
    },
    createServer: async ({ phaseObserver }) => {
      await phaseObserver.measure('container_start', () => {});
      return { close: () => phaseObserver.measure('container_stop', () => {}) };
    },
  };
  return { options, calls, updates, files };
}

test('cohort comparison preserves all five files in counterbalanced profile and reversed file order after release', async () => {
  const f = fixture(); const report = await comparePostgresCohort(f.options);
  assert.equal(report.complete, true); assert.equal(report.samples.length, 4); assert.equal(report.pairs.length, 2);
  assert.deepEqual(report.samples.map(({ mode, order }) => [mode, order]),
    [['isolated', 'forward'], ['shared', 'forward'], ['shared', 'reverse'], ['isolated', 'reverse']]);
  assert.deepEqual(f.calls, [...f.files, ...f.files, ...f.files.toReversed(), ...f.files.toReversed()]);
  assert.deepEqual(f.updates.map(update => [update.samples.length, update.complete]), [[1, false], [2, false], [3, false], [4, false], [4, true]]);
  assert.equal(report.samples[1].ownership.reaped, 0);
});

test('copied comparison environment removes borrowed/parent credentials, runner options and fixture overrides without mutating input', () => {
  const original = { ...environment, PGPASSWORD: 'secret', POSTGRES_PASSWORD: 'secret', HARMONIARR_TEST_PG_TOKEN: 'secret',
    HARMONIARR_INTEGRATION_PG_POOL_MAX: '99', HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE: 'empty', NODE_OPTIONS: '--test-only',
    NODE_TEST_CONTEXT: 'controlled', CUSTOM: 'retained' };
  const copy = createPostgresCohortEnvironment(original);
  for (const key of ['PGPASSWORD', 'POSTGRES_PASSWORD', 'HARMONIARR_TEST_PG_TOKEN', 'HARMONIARR_INTEGRATION_PG_POOL_MAX',
    'HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) assert.equal(Object.hasOwn(copy, key), false);
  assert.equal(copy.CUSTOM, 'retained'); assert.equal(copy.TESTCONTAINERS_REUSE_ENABLE, 'false');
  assert.equal(original.PGPASSWORD, 'secret');
  assert.throws(() => createPostgresCohortEnvironment({ ...environment, HARMONIARR_INTEGRATION_POSTGRES_IMAGE: 'postgres:18-alpine' }), TypeError);
});

for (const stage of ['pre_abort', 'file', 'sink']) for (const primary of [new Error('controlled'), null]) {
  test(`${stage} retains original ${primary === null ? 'null' : 'Error'} and refuses further samples through artifact fallout`, async () => {
    const f = fixture(); const controller = new AbortController();
    f.options.onUpdate = async report => { assert.equal(report.complete, false); throw new Error('secondary-artifact'); };
    if (stage === 'pre_abort') controller.abort(primary);
    if (stage === 'file') f.options.runFile = async () => { throw primary; };
    if (stage === 'sink') f.options.onUpdate = async () => { throw primary; };
    await assert.rejects(comparePostgresCohort({ ...f.options, signal: controller.signal }), error => error === primary);
    assert.equal(f.calls.length, stage === 'sink' ? 5 : 0);
  });
}

for (const fault of ['missing', 'duplicate', 'skip', 'case', 'work', 'source', 'reaped', 'unreleased']) {
  test(`comparison refuses ${fault} evidence and retains partial samples without a saving claim`, async () => {
    const f = fixture(); const runFile = f.options.runFile; let calls = 0; let hashes = 0;
    if (fault === 'source') f.options.fingerprint = async () => ({ sha256: ++hashes > 3 ? 'changed' : 'original' });
    else if (fault === 'reaped' || fault === 'unreleased') {
      const shared = f.options.runShared;
      f.options.runShared = async options => ({ ...await shared(options), ...(fault === 'reaped' ? { reaped: 1 } : { released: 4 }) });
    } else f.options.runFile = async options => {
      calls++;
      if (calls <= 5) return runFile(options);
      const value = evidence();
      if (fault === 'skip') value.counts.skipped = 1;
      if (fault === 'case') value.caseDigest = 'c'.repeat(64);
      if (fault === 'work') value.phases.scenario_work.count++;
      const line = cohortEvidenceMarker + JSON.stringify(value) + '\n';
      if (fault !== 'missing') await new Promise((done, reject) => { options.stderr.write(fault === 'duplicate' ? line + line : line, error => error ? reject(error) : done()); });
      return { exitCode: 0, signal: null, durationMs: 2 };
    };
    await assert.rejects(comparePostgresCohort(f.options), { code: 'fixture_cohort_evidence_refused' });
    const partial = f.updates.at(-1); assert.equal(partial.failed, true); assert.equal(partial.complete, false);
    assert.equal(partial.samples.length, 1); assert.equal(Object.hasOwn(partial, 'pairs'), false);
  });
}

test('comparison awaits a held partial-artifact sink before admitting the next native profile', async () => {
  const f = fixture(); const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let first = true;
  f.options.onUpdate = async () => { if (first) { first = false; entered.resolve(); await hold.promise; } };
  const pending = comparePostgresCohort(f.options); const observed = pending.catch(() => {});
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending }); assert.equal(f.calls.length, 5);
    hold.resolve(); assert.equal((await pending).complete, true);
  } finally { hold.resolve(); await observed; }
});

test('framing handles split UTF-8 and refuses oversized lines without retaining private text', () => {
  const lines = []; const parser = createCohortLines(line => lines.push(line)); const input = Buffer.from('é\r\nlast');
  parser.write(input.subarray(0, 1)); parser.write(input.subarray(1)); parser.end(); assert.deepEqual(lines, ['é', 'last']);
  assert.throws(() => createCohortLines(() => {}).write('x'.repeat(65_537)), { code: 'fixture_cohort_evidence_refused' });
  for (const value of [null, { ...evidence(), caseEvents: 2 }, { ...evidence(), success: false }]) {
    assert.throws(() => validateCohortFileEvidence(value), { code: 'fixture_cohort_evidence_refused' });
  }
});

test('installed Node reporter supplies native counts, exact outcome hashes and approved phases without raw canaries', async () => {
  const execute = promisify(execFile);
  const { NODE_TEST_CONTEXT: _nodeContext, ...childEnv } = process.env;
  for (const skip of ['0', '1']) {
    const { stdout } = await execute(process.execPath, ['--test', '--test-reporter=./testing/reporters/postgres-cohort-reporter.js',
      'testing/fixtures/postgres-cohort-reporter-fixture.js'], { cwd: process.cwd(), env: { ...childEnv,
      COHORT_CONTROL_SKIP: skip }, timeout: 30_000, windowsHide: true, maxBuffer: 64 * 1024 });
    assert.equal(stdout.includes('private-case-canary'), false); assert.equal(stdout.includes('private-suite-canary'), false);
    const record = JSON.parse(stdout.trim().slice(cohortEvidenceMarker.length));
    assert.equal(record.counts.tests, 2); assert.equal(record.counts.suites, 1); assert.equal(record.caseEvents, 3);
    assert.equal(record.phases.scenario_work.count, 1); assert.equal(record.phases.scenario_work.durationMs, 3);
    if (skip === '0') assert.equal(validateCohortFileEvidence(record).counts.passed, 2);
    else assert.throws(() => validateCohortFileEvidence(record), { code: 'fixture_cohort_evidence_refused' });
  }
});
