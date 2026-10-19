/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { createIntegrationEvidenceReporter } from '../../testing/reporters/integration-evidence-reporter.js';
import { createPostgresCohortAccumulator } from '../../testing/reporters/postgres-cohort-accumulator.js';
import { earlyFailureMarker } from '../../testing/reporters/early-failure-format.js';
import { cohortEvidenceMarker, validateCohortFileEvidence } from '../../testing/integration/postgres-cohort-evidence.js';

const report = createIntegrationEvidenceReporter();
const execute = promisify(execFile);
const failure = { type: 'test:fail', data: { name: 'private-case-canary', file: resolve(import.meta.filename),
  line: 20, column: 1, nesting: 0, details: { error: { cause: new Error('private-message-canary') } } } };
const summary = { type: 'test:summary', data: { success: false,
  counts: { tests: 1, suites: 0, passed: 0, failed: 1, cancelled: 0, skipped: 0, todo: 0, topLevel: 1 } } };
const recordFrom = output => JSON.parse(output.trim().split('\n').find(line => line.startsWith(cohortEvidenceMarker)).slice(cohortEvidenceMarker.length));

test('combined reporting pulls once and emits bounded failure before a held later event or final EOF', async () => {
  const gate = Promise.withResolvers();
  let pulls = 0;
  let returned = false;
  async function* events() {
    try {
      pulls++; yield failure;
      pulls++; await gate.promise; yield summary;
    } finally { returned = true; }
  }
  const output = report(events());
  try {
    const first = await output.next();
    assert.equal(first.value.startsWith(earlyFailureMarker), true);
    assert.equal(first.value.includes('private-'), false);
    assert.equal(pulls, 1);
    const next = output.next();
    let settled = false;
    next.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    gate.resolve();
    const final = await next;
    assert.equal(final.value.startsWith(cohortEvidenceMarker), true);
    assert.equal(returned, true);
    assert.equal(recordFrom(final.value).counts.failed, 1);
    assert.equal((await output.next()).done, true);
    assert.equal(pulls, 2);
  } finally { gate.resolve(); await output.return(); }
});

test('consumer return finalizes the actual source without publishing completion', async () => {
  let returned = false;
  async function* events() {
    try { yield failure; assert.fail('Cancelled consumer requested another event'); }
    finally { returned = true; }
  }
  const output = report(events());
  assert.equal((await output.next()).value.startsWith(earlyFailureMarker), true);
  assert.deepEqual(await output.return(), { value: undefined, done: true });
  assert.equal(returned, true);
});

for (const reason of [new Error('Original source failure'), null]) {
  test(`original source ${reason === null ? 'null' : 'Error'} propagates even after a summary without completion`, async () => {
    let returned = false;
    async function* events() { try { yield summary; throw reason; } finally { returned = true; } }
    await assert.rejects(report(events()).next(), error => error === reason);
    assert.equal(returned, true);
  });
}

test('missing, duplicate or invalid cohort evidence cannot publish a final record', async () => {
  for (const events of [[], [summary, summary], [{ type: 'test:stderr', data: {
    message: '[fixture-phase] {"phase":"scenario_work","outcome":"unknown","durationMs":0}\n',
  } }]]) {
    await assert.rejects(report((async function* () { yield* events; })()).next(), { code: 'fixture_cohort_evidence_refused' });
  }
  const accumulator = createPostgresCohortAccumulator();
  assert.throws(() => accumulator.write(null), TypeError);
  assert.throws(() => accumulator.end(), { code: 'fixture_cohort_evidence_refused' });
});

test('native spec plus combined evidence retains exact standalone counts, digests and phases without listener warnings', async () => {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  for (const skip of ['0', '1']) {
    const options = { env: { ...env, COHORT_CONTROL_SKIP: skip }, timeout: 30_000, windowsHide: true, maxBuffer: 64 * 1024 };
    const fixture = 'testing/fixtures/postgres-cohort-reporter-fixture.js';
    const standalone = await execute(process.execPath, ['--test', '--test-reporter=./testing/reporters/postgres-cohort-reporter.js', fixture], options);
    const combined = await execute(process.execPath, ['--trace-warnings', '--test', '--test-concurrency=1', '--test-reporter=spec',
      '--test-reporter=./testing/reporters/integration-evidence-reporter.js', '--test-reporter-destination=stdout',
      '--test-reporter-destination=stderr', fixture], options);
    assert.deepEqual(recordFrom(combined.stderr), recordFrom(standalone.stdout));
    assert.equal(combined.stderr.includes('MaxListenersExceededWarning'), false);
    assert.equal(combined.stderr.includes('private-'), false);
    assert.equal(combined.stdout.includes('private-case-canary'), true);
    if (skip === '0') assert.equal(validateCohortFileEvidence(recordFrom(combined.stderr)).counts.passed, 2);
    else assert.throws(() => validateCohortFileEvidence(recordFrom(combined.stderr)), { code: 'fixture_cohort_evidence_refused' });
  }
});

test('ordinary listener warnings remain visible through native spec with the default threshold', async () => {
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  const output = await execute(process.execPath, ['--test', '--test-reporter=spec',
    '--test-reporter=./testing/reporters/integration-evidence-reporter.js', '--test-reporter-destination=stdout',
    '--test-reporter-destination=stderr', 'testing/fixtures/reporter-warning-control.js'],
  { env, timeout: 30_000, windowsHide: true, maxBuffer: 64 * 1024 });
  assert.equal(output.stdout.includes('MaxListenersExceededWarning'), true);
  assert.equal(output.stdout.includes('[EventEmitter]'), true);
  assert.equal(output.stderr.includes('[TestsStream]'), false);
  assert.equal(validateCohortFileEvidence(recordFrom(output.stderr)).counts.passed, 1);
});
