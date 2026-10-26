/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { runMigrationCli } from './migration-cli-runtime.js';
import { formatDatabaseMigrationStateDiagnostics, inspectDatabaseMigrationState } from './schema-migration-state-service.js';

await runMigrationCli({
  prefix: 'harmoniarr-diagnose-migrations',
  renderSuccessMessage: formatDatabaseMigrationStateDiagnostics,
  run: inspectDatabaseMigrationState,
});
