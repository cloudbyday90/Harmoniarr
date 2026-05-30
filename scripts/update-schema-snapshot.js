/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runMigrationCli } from '../src/server/migration-cli-runtime.js';
import { updateSchemaSnapshot } from './schema-snapshot.js';

await runMigrationCli({
  prefix: 'harmoniarr-update-schema-snapshot',
  renderSuccessMessage: ({ migrationCount, snapshotPath }) => {
    return `Updated schema snapshot at ${snapshotPath} from ${migrationCount} migration(s)`;
  },
  run: updateSchemaSnapshot,
});
