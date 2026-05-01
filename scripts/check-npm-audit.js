/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runNpmAudit } from './npm-audit.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-npm-audit',
  renderSuccessMessage: ({ vulnerabilityCounts }) => {
    return `npm audit passed with ${vulnerabilityCounts.total} reported vulnerabilities.`;
  },
  run: () => runNpmAudit(),
});