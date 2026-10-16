/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { glob, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { sharedPostgresTestCohort } from './postgres-test-cohort.js';

export const integrationTestPattern = 'test/integration/**/*.test.js';

export function integrationCoordinatorRefusal() {
  return Object.assign(new Error('Complete integration coverage could not be verified'),
    { code: 'fixture_integration_coverage_refused' });
}

export function createIntegrationTestPlan(files) {
  if (!Array.isArray(files) || !files.length) throw integrationCoordinatorRefusal();
  const selected = new Set();
  for (const file of files) {
    if (typeof file !== 'string' || !file.startsWith('test/integration/') || !file.endsWith('.test.js')
      || /[\\\0\r\n]/u.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')
      || selected.has(file)) throw integrationCoordinatorRefusal();
    selected.add(file);
  }
  if (sharedPostgresTestCohort.some(file => !selected.has(file))) throw integrationCoordinatorRefusal();
  const shared = new Set(sharedPostgresTestCohort);
  const isolated = [...selected].filter(file => !shared.has(file)).sort();
  return Object.freeze([
    Object.freeze({ mode: 'shared', files: sharedPostgresTestCohort }),
    ...isolated.map(file => Object.freeze({ mode: 'isolated', files: Object.freeze([file]) })),
  ]);
}

export async function discoverIntegrationTestFiles({ cwd = process.cwd() } = {}) {
  const root = await realpath(cwd); const files = [];
  for await (const entry of glob(integrationTestPattern, { cwd: root })) {
    const file = entry.replaceAll('\\', '/');
    const absolute = await realpath(resolve(root, file));
    const delta = relative(root, absolute).replaceAll('\\', '/');
    if (isAbsolute(delta) || delta !== file || !(await stat(absolute)).isFile()) throw integrationCoordinatorRefusal();
    files.push(file);
  }
  // Validate the complete population, including missing reviewed cohort members.
  createIntegrationTestPlan(files);
  return Object.freeze(files.sort());
}
