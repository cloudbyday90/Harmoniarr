/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  collectBrowserValidationSamples,
  createBrowserValidationSampleCollectionSummary,
} from './browser-validation-sample-collection.js';
import { getRequiredStringInput } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const browserValidationSampleCollectionOutputPathEnvVar = 'HARMONIARR_BROWSER_VALIDATION_SAMPLE_COLLECTION_OUTPUT_PATH';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-browser-validation-sample-collection',
  renderSuccessMessage: createBrowserValidationSampleCollectionSummary,
  run: () => collectBrowserValidationSamples({
    outputPath: getRequiredStringInput(
      {},
      'outputPath',
      browserValidationSampleCollectionOutputPathEnvVar,
      process.env,
    ),
  }),
});
