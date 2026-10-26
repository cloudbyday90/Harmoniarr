/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { runMigrationCli } from '../src/server/migration-cli-runtime.js';
import { updateSchemaAnchorContract } from './schema-anchor-contract.js';

await runMigrationCli({
  prefix: 'harmoniarr-update-schema-anchor-contract',
  run: updateSchemaAnchorContract,
  renderSuccessMessage: ({ anchorCount }) => `Updated schema anchor contract from fresh migrations (${anchorCount} anchors)`,
});
