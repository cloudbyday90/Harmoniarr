/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { checkNodeBaseline } from './node-baseline-policy.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-node-baseline',
  renderSuccessMessage: ({ version }) => `Node ${version} matches the canonical validation baseline.`,
  run: () => checkNodeBaseline(),
});
