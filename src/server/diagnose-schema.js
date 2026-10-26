/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { runMigrationCli } from './migration-cli-runtime.js';
import { inspectDatabaseSchemaDrift } from './schema-drift-service.js';
import { formatSchemaDriftDiagnostics } from './schema-drift-report-policy.js';

await runMigrationCli({
  prefix: 'harmoniarr-diagnose-schema',
  renderSuccessMessage: formatSchemaDriftDiagnostics,
  run: async () => {
    const report = await inspectDatabaseSchemaDrift();
    if (!report.current) process.exitCode = 1;
    return report;
  },
});
