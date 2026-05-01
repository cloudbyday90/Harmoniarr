/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runDirectScriptTask } from './script-runtime.js';
import { validateSchemaBootstrap } from './schema-bootstrap-validation.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-schema-bootstrap',
  renderSuccessMessage: ({ appliedCount, migrationCount, schemaSnapshotPath }) => {
    return `Schema snapshot bootstrap is valid at ${schemaSnapshotPath} (${appliedCount}/${migrationCount} migrations applied)`;
  },
  run: validateSchemaBootstrap,
});