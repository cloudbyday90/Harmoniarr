/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runMigrationCli } from '../src/server/migration-cli-runtime.js';
import { formatDatabaseMigrationStateSummary } from '../src/server/schema-migration-state-service.js';
import { checkDatabaseBackedSchema } from './schema-snapshot.js';

await runMigrationCli({
  prefix: 'harmoniarr-check-database-schema',
  renderSuccessMessage: ({ bootstrap, databaseState, snapshot }) => {
    return [
      `source database current (${formatDatabaseMigrationStateSummary(databaseState)})`,
      `committed snapshot current at ${snapshot.snapshotPath} (${snapshot.migrationCount} migration(s))`,
      `fresh snapshot bootstrap valid (${bootstrap.appliedCount}/${bootstrap.migrationCount} migrations applied)`,
    ].join('; ');
  },
  run: checkDatabaseBackedSchema,
});
