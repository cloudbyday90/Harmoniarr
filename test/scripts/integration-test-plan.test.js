/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createIntegrationTestPlan, discoverIntegrationTestFiles } from '../../testing/integration/integration-test-plan.js';
import { sharedPostgresTestCohort } from '../../testing/integration/postgres-test-cohort.js';

const executeFile = promisify(execFile);
const cohort = [...sharedPostgresTestCohort];

async function workspace(t, files = cohort) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'harmoniarr-integration-plan-')));
  t.after(async () => { assert.equal(await realpath(root), root); await rm(root, { recursive: true, force: true }); });
  for (const file of files) { await mkdir(dirname(join(root, file)), { recursive: true }); await writeFile(join(root, file), ''); }
  return root;
}

test('plan covers every selected file once, retains reviewed cohort order and sorts isolated nested files', () => {
  const files = ['test/integration/z.test.js', ...cohort.toReversed(), 'test/integration/nested/a.test.js'];
  const plan = createIntegrationTestPlan(files);
  assert.deepEqual(plan[0], { mode: 'shared', files: cohort });
  assert.deepEqual(plan.slice(1).flatMap(step => step.files), ['test/integration/nested/a.test.js', 'test/integration/z.test.js']);
  assert.deepEqual(plan.flatMap(step => step.files).sort(), [...files].sort());
  assert.equal(Object.isFrozen(plan) && plan.every(step => Object.isFrozen(step) && Object.isFrozen(step.files)), true);
  files.length = 0; assert.equal(plan.flatMap(step => step.files).length, cohort.length + 2);
});

for (const [name, extra] of Object.entries({ duplicate: [cohort[0]], traversal: ['test/integration/../server/a.test.js'],
  absolute: [resolve('test/integration/z.test.js')], option: ['--test-force-exit'], other: ['test/server/a.test.js'],
  directory: ['test/integration/a'], newline: ['test/integration/a\n.test.js'], backslash: ['test\\integration\\a.test.js'] })) {
  test(`plan refuses ${name} selection`, () => {
    assert.throws(() => createIntegrationTestPlan([...cohort, ...extra]), { code: 'fixture_integration_coverage_refused' });
  });
}
test('plan refuses missing reviewed files, sparse input and empty selection', () => {
  for (const files of [[], cohort.slice(1), [...cohort, ...Array(1)]]) {
    assert.throws(() => createIntegrationTestPlan(files), { code: 'fixture_integration_coverage_refused' });
  }
});

test('filesystem discovery includes nested tests, excludes helpers and refuses an incomplete cohort', async t => {
  const root = await workspace(t, [...cohort, 'test/integration/nested/z.test.js', 'test/integration/helper.js', 'test/server/a.test.js']);
  assert.deepEqual(await discoverIntegrationTestFiles({ cwd: root }), [...cohort, 'test/integration/nested/z.test.js'].sort());
  await rm(join(root, cohort[0]));
  await assert.rejects(discoverIntegrationTestFiles({ cwd: root }), { code: 'fixture_integration_coverage_refused' });
});

test('filesystem discovery refuses an integration directory redirected outside the canonical workspace', async t => {
  const outside = await workspace(t); const root = await workspace(t, []);
  await mkdir(join(root, 'test'));
  await symlink(join(outside, 'test/integration'), join(root, 'test/integration'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(discoverIntegrationTestFiles({ cwd: root }), { code: 'fixture_integration_coverage_refused' });
});

test('actual CLI plan matches independent recursive inventory and rejects selection arguments without native work', async () => {
  const independent = (await readdir('test/integration', { recursive: true })).filter(file => file.endsWith('.test.js'))
    .map(file => 'test/integration/' + file.replaceAll('\\', '/')).sort();
  const { stdout, stderr } = await executeFile(process.execPath, ['scripts/run-integration-tests.js', '--plan'], { windowsHide: true });
  assert.equal(stderr, ''); const plan = JSON.parse(stdout);
  assert.equal(plan.files, independent.length);
  assert.deepEqual(plan.steps.flatMap(step => step.files).sort(), independent);
  assert.equal(plan.steps.filter(step => step.mode === 'shared').length, 1);
  await assert.rejects(executeFile(process.execPath, ['scripts/run-integration-tests.js', '--test-force-exit'], { windowsHide: true }), error => {
    assert.equal(error.code, 1); assert.equal(error.stdout, '');
    assert.equal(error.stderr.trim(), '[integration-coordinator] fixture_integration_run_failed'); return true;
  });
});
