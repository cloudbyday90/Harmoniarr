/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

export const sharedPostgresTestCohort = Object.freeze([
  'test/integration/library-wanted-release-reconciliation.test.js',
  'test/integration/library-scan-catalogue.test.js',
  'test/integration/library-release-reconciliation.test.js',
  'test/integration/library-tag-snapshot.test.js',
]);

export async function resolvePostgresTestCohort({ args = [], cwd = process.cwd() } = {}) {
  if (!Array.isArray(args) || !args.every((file) => sharedPostgresTestCohort.includes(file))
    || new Set(args).size !== args.length) throw new TypeError('Only the verified PostgreSQL test cohort is supported');
  const root = await realpath(cwd);
  const files = args.length ? args : sharedPostgresTestCohort;
  const resolved = [];
  for (const file of files) {
    const absolute = await realpath(resolve(root, file));
    const delta = relative(root, absolute);
    if (!delta || delta.startsWith('..') || isAbsolute(delta) || !(await stat(absolute)).isFile()) {
      throw new TypeError('The PostgreSQL test file must stay in the workspace');
    }
    resolved.push(absolute);
  }
  return resolved;
}
