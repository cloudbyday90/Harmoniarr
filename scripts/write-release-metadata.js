/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { writeReleaseMetadataFiles } from './release-metadata.js';
import { resolveWriteReleaseMetadataInputs } from './release-script-inputs.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-write-release-metadata',
    renderSuccessMessage: ({ composeOverridePath, metadataPath, verificationPath }) => {
      return `Release metadata assets written to ${metadataPath}, ${verificationPath}, and ${composeOverridePath}`;
    },
    run: () => writeReleaseMetadataFiles(resolveWriteReleaseMetadataInputs()),
  });