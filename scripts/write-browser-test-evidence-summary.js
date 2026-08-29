/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  browserTestEvidencePathEnvVar,
  browserTestEvidenceSummaryPathEnvVar,
  writeBrowserTestEvidenceSummary,
} from './browser-test-evidence.js';
import { getRequiredStringInput } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-browser-test-evidence-summary',
  renderSuccessMessage: () => null,
  run: () => writeBrowserTestEvidenceSummary({
    evidencePath: getRequiredStringInput({}, 'evidencePath', browserTestEvidencePathEnvVar, process.env),
    summaryPath: getRequiredStringInput({}, 'summaryPath', browserTestEvidenceSummaryPathEnvVar, process.env),
  }),
});
