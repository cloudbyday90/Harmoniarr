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

import { assertBrowserRuntimeDiagnosticWorkflowContract } from '../../scripts/browser-runtime-diagnostic-workflow-contract.js';

const workflowPath = new URL('../../.github/workflows/browser-runtime-diagnostic.yml', import.meta.url);

test('browser runtime diagnostic workflow remains manual, bounded, and read-only', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.equal(assertBrowserRuntimeDiagnosticWorkflowContract(workflowSource), true);
});
