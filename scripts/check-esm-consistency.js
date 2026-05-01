/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { resolve } from 'node:path';
import { checkEsmConsistency } from './esm-consistency.js';
import { runDirectScriptTask } from './script-runtime.js';

const rootDir = process.cwd();
const packageJsonPath = resolve(rootDir, 'package.json');
await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-esm',
  renderSuccessMessage: () => 'ESM consistency check passed.',
  run: () => checkEsmConsistency({ packageJsonPath, rootDir }),
});