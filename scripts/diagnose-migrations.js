/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runMigrationCli } from '../src/server/migration-cli-runtime.js';
import {
  formatDatabaseMigrationStateDiagnostics,
  inspectDatabaseMigrationState,
} from '../src/server/schema-migration-state-service.js';

await runMigrationCli({
  prefix: 'harmoniarr-diagnose-migrations',
  renderSuccessMessage: formatDatabaseMigrationStateDiagnostics,
  run: inspectDatabaseMigrationState,
});
