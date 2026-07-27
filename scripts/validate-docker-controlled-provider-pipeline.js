/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { runDirectScriptTask } from './script-runtime.js';
import {
  resolveDockerControlledProviderPipelineValidationInputs,
  runDockerControlledProviderPipelineValidation,
} from './docker-controlled-provider-pipeline-validation.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-controlled-provider-pipeline',
  renderSuccessMessage: (result) => `Verified the controlled provider pipeline: ${result.catalogFixtures} synthetic fixtures, ${result.catalogCandidates} ingested matches, two verified library adds, and failed-match fallback recovery.`,
  run: () => runDockerControlledProviderPipelineValidation(
    resolveDockerControlledProviderPipelineValidationInputs(),
  ),
});
