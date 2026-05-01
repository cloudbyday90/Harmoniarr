/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runDirectScriptTask } from './script-runtime.js';
import { checkSchemaSnapshot } from './schema-snapshot.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-schema-snapshot',
  renderSuccessMessage: ({ migrationCount, snapshotPath }) => {
    return `Schema snapshot is current at ${snapshotPath} (${migrationCount} migration(s))`;
  },
  run: checkSchemaSnapshot,
});