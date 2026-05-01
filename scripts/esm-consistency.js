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

const filePatterns = [
  'src/**/*.js',
  'src/**/*.vue',
  'scripts/**/*.js',
  'vite.config.js',
];

const ignoredFiles = new Set(['scripts/check-esm-consistency.js']);

function joinToken(...parts) {
  return parts.join('');
}

const requireToken = joinToken('req', 'uire');
const moduleExportsToken = joinToken('module', '.', 'exports');
const exportsToken = joinToken('exp', 'orts');
const dirnameToken = joinToken('__dir', 'name');
const filenameToken = joinToken('__file', 'name');

const forbiddenPatterns = [
  {
    label: 'CommonJS require call',
    pattern: new RegExp(String.raw`(^|[^.\w$])${requireToken}\s*\(`, 'm'),
  },
  {
    label: 'CommonJS module export assignment',
    pattern: new RegExp(String.raw`\b${moduleExportsToken.replace('.', '\\.')}\b`, 'm'),
  },
  {
    label: 'CommonJS exports member assignment',
    pattern: new RegExp(String.raw`\b${exportsToken}\s*\.`, 'm'),
  },
  {
    label: 'Node dirname global usage',
    pattern: new RegExp(String.raw`\b${dirnameToken}\b`, 'm'),
  },
  {
    label: 'Node filename global usage',
    pattern: new RegExp(String.raw`\b${filenameToken}\b`, 'm'),
  },
];

export function lineNumberForIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function listEsmConsistencyFiles({
  cwd,
  glob = globSync,
} = {}) {
  return [...new Set(filePatterns.flatMap((pattern) => glob(pattern, { cwd, nodir: true })))].sort();
}

export function extractScannableSections(relativePath, source) {
  if (!relativePath.endsWith('.vue')) {
    return [{
      lineOffset: 0,
      source,
    }];
  }

  const sections = [];
  const scriptTagPattern = /^\s*<script\b[^>]*>([\s\S]*?)<\/script>/gm;
  let match = scriptTagPattern.exec(source);

  while (match) {
    sections.push({
      lineOffset: lineNumberForIndex(source, match.index + match[0].indexOf(match[1])) - 1,
      source: match[1],
    });
    match = scriptTagPattern.exec(source);
  }

  return sections;
}

export function findEsmViolations(relativePath, source) {
  const violations = [];

  for (const section of extractScannableSections(relativePath, source)) {
    for (const rule of forbiddenPatterns) {
      const match = rule.pattern.exec(section.source);
      if (match) {
        violations.push({
          relativePath,
          line: section.lineOffset + lineNumberForIndex(section.source, match.index),
          label: rule.label,
        });
      }
    }
  }

  return violations;
}

export async function checkEsmConsistency({
  packageJsonPath,
  readFileImpl = readFile,
  rootDir,
} = {}) {
  const packageJson = JSON.parse(await readFileImpl(packageJsonPath, 'utf8'));
  if (packageJson.type !== 'module') {
    throw new Error('package.json must keep "type": "module" for this repo.');
  }

  const files = listEsmConsistencyFiles({ cwd: rootDir });
  const violations = [];

  for (const relativePath of files) {
    if (ignoredFiles.has(relativePath.replace(/\\/g, '/'))) {
      continue;
    }

    const source = await readFileImpl(resolve(rootDir, relativePath), 'utf8');
    violations.push(...findEsmViolations(relativePath, source));
  }

  if (violations.length > 0) {
    const lines = violations.map((violation) => `- ${violation.relativePath}:${violation.line} ${violation.label}`);
    throw new Error(`ESM consistency check failed:\n${lines.join('\n')}`);
  }
}