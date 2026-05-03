/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { checkTestHygiene } from './test-hygiene.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-test-hygiene',
  renderSuccessMessage: ({ checkedFiles }) => `Test hygiene check passed for ${checkedFiles} file(s).`,
  run: () => checkTestHygiene(),
});
