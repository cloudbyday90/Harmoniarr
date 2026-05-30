/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runMigrationCli } from '../src/server/migration-cli-runtime.js';
import { validateSchemaAnchorsAgainstSnapshot } from './schema-anchor-validation.js';

await runMigrationCli({
  prefix: 'harmoniarr-check-schema-anchors',
  renderSuccessMessage: ({ anchorCount, schemaSnapshotPath }) => {
    return `Critical schema anchors match source database and snapshot bootstrap at ${schemaSnapshotPath} (${anchorCount} anchor(s))`;
  },
  run: validateSchemaAnchorsAgainstSnapshot,
});
