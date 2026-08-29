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

import { assertBrowserValidationWorkflowContract } from '../../scripts/browser-validation-workflow-contract.js';

const workflowPath = new URL('../../.github/workflows/browser-validation.yml', import.meta.url);

test('browser validation workflow retains pinned actions and bounded cleanup evidence', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.equal(assertBrowserValidationWorkflowContract(workflowSource), true);
});
