/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  renderReleaseEvidencePackSuccessMessage,
  runReleaseEvidencePackFromEnvironment,
} from './release-evidence-pack.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-release-evidence-pack',
  renderSuccessMessage: renderReleaseEvidencePackSuccessMessage,
  run: () => runReleaseEvidencePackFromEnvironment(),
});
