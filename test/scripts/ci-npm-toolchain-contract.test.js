/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertCiNpmToolchainContract,
  assertInstallScriptPolicy,
  getPinnedNpmVersion,
} from '../../scripts/ci-npm-toolchain-contract.js';

const packagePath = new URL('../../package.json', import.meta.url);
const toolchainActionPath = new URL('../../.github/actions/setup-project-npm/action.yml', import.meta.url);
const dependencyInstallingWorkflowPaths = [
  '../../.github/workflows/browser-validation.yml',
  '../../.github/workflows/copyright-compliance.yml',
  '../../.github/workflows/security-scanning.yml',
  '../../.github/workflows/supply-chain.yml',
].map((path) => new URL(path, import.meta.url));

test('dependency-installing CI jobs use the pinned npm and deny optional fsevents scripts', async () => {
  const [packageSource, actionSource, ...workflowSources] = await Promise.all([
    readFile(packagePath, 'utf8'),
    readFile(toolchainActionPath, 'utf8'),
    ...dependencyInstallingWorkflowPaths.map((path) => readFile(path, 'utf8')),
  ]);
  const packageManifest = JSON.parse(packageSource);

  assert.equal(assertInstallScriptPolicy(packageManifest), true);
  assert.equal(
    assertCiNpmToolchainContract(actionSource, getPinnedNpmVersion(packageManifest)),
    true,
  );

  for (const workflowSource of workflowSources) {
    assert.match(workflowSource, /uses: \.\/\.github\/actions\/setup-project-npm/);
  }
});
