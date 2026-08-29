/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  browserTestEvidenceReviewInputPathEnvVar,
  browserTestEvidenceReviewOutputPathEnvVar,
  renderBrowserTestEvidenceReviewSummary,
  writeBrowserTestEvidenceReview,
} from './browser-test-evidence-review.js';
import { getRequiredStringInput } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-browser-test-evidence-review',
  renderSuccessMessage: ({ review }) => renderBrowserTestEvidenceReviewSummary(review),
  run: () => writeBrowserTestEvidenceReview({
    inputPath: getRequiredStringInput(
      {},
      'inputPath',
      browserTestEvidenceReviewInputPathEnvVar,
      process.env,
    ),
    outputPath: getRequiredStringInput(
      {},
      'outputPath',
      browserTestEvidenceReviewOutputPathEnvVar,
      process.env,
    ),
  }),
});
