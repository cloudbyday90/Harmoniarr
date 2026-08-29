/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  browserRuntimeDiagnosticEvidencePathEnvVar,
  browserRuntimeDiagnosticSummaryPathEnvVar,
  writeBrowserRuntimeDiagnosticSummary,
} from './browser-runtime-diagnostic-evidence.js';
import { getRequiredStringInput } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-browser-runtime-diagnostic-summary',
  renderSuccessMessage: () => null,
  run: () => writeBrowserRuntimeDiagnosticSummary({
    evidencePath: getRequiredStringInput({}, 'evidencePath', browserRuntimeDiagnosticEvidencePathEnvVar, process.env),
    summaryPath: getRequiredStringInput({}, 'summaryPath', browserRuntimeDiagnosticSummaryPathEnvVar, process.env),
  }),
});
