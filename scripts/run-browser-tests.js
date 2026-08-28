/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runBrowserTests } from './browser-test-runner.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-browser-tests',
  renderSuccessMessage: () => null,
  run: () => runBrowserTests(),
  stderrStyle: 'raw',
  stdoutStyle: 'raw',
});
