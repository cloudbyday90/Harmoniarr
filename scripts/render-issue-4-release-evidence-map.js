/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { writeIssue4ReleaseEvidenceMap } from './issue-4-release-evidence-map.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-issue-4-evidence-map',
  renderSuccessMessage: ({ checkedFiles, outputPath, stepCount }) => (
    `Issue #4 release evidence map wrote ${stepCount} step(s) to ${outputPath} `
      + `after checking ${checkedFiles} referenced test file(s).`
  ),
  run: () => writeIssue4ReleaseEvidenceMap(),
});
