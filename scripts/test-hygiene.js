/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { globSync } from 'glob';

const shorthandPatterns = [
  { kind: 'focused_test', message: 'Found focused test shorthand that would narrow coverage in CI.', pattern: /\b(?:test|it|describe|suite)\.only\s*\(/g },
  { kind: 'skipped_test', message: 'Found skipped test shorthand that would silently bypass coverage.', pattern: /\b(?:test|it|describe|suite)\.skip\s*\(/g },
  { kind: 'todo_test', message: 'Found TODO test shorthand that leaves an incomplete test contract in the suite.', pattern: /\b(?:test|it|describe|suite)\.todo\s*\(/g },
];

const optionPatterns = [
  { kind: 'focused_test_option', message: 'Found explicit `{ only: true }` test option.', pattern: /\bonly\s*:\s*true\b/g },
  { kind: 'skipped_test_option', message: 'Found explicit `{ skip: true }` test option.', pattern: /\bskip\s*:\s*true\b/g },
  { kind: 'todo_test_option', message: 'Found explicit `{ todo: true }` test option.', pattern: /\btodo\s*:\s*true\b/g },
];

function findLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collectPatternViolations(relativePath, source, descriptors) {
  const violations = [];

  for (const descriptor of descriptors) {
    descriptor.pattern.lastIndex = 0;

    for (const match of source.matchAll(descriptor.pattern)) {
      violations.push({
        kind: descriptor.kind,
        line: findLineNumber(source, match.index ?? 0),
        message: descriptor.message,
        relativePath,
      });
    }
  }

  return violations;
}

export function listTestHygieneFiles({ cwd = process.cwd(), glob = globSync } = {}) {
  return glob('test/**/*.js', { cwd, nodir: true }).sort();
}

export function findTestHygieneViolations(relativePath, source) {
  return [
    ...collectPatternViolations(relativePath, source, shorthandPatterns),
    ...collectPatternViolations(relativePath, source, optionPatterns),
  ].sort((left, right) => left.line - right.line || left.kind.localeCompare(right.kind));
}

export function formatTestHygieneViolations(violations) {
  if (!violations.length) {
    return 'No test hygiene violations found.';
  }

  return [
    'Found test hygiene violations:',
    ...violations.map((violation) => `  - ${violation.relativePath}:${violation.line} ${violation.kind}: ${violation.message}`),
  ].join('\n');
}

export async function checkTestHygiene({
  cwd = process.cwd(),
  glob = globSync,
  readFileFn = readFile,
} = {}) {
  const files = listTestHygieneFiles({ cwd, glob });
  const violations = [];

  for (const relativePath of files) {
    const source = await readFileFn(resolve(cwd, relativePath), 'utf8');
    violations.push(...findTestHygieneViolations(relativePath, source));
  }

  if (violations.length) {
    throw new Error(formatTestHygieneViolations(violations));
  }

  return {
    checkedFiles: files.length,
  };
}
