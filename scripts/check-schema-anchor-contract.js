/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { runDirectScriptTask } from './script-runtime.js';
import { checkSchemaAnchorContract } from './schema-anchor-contract.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-schema-anchor-contract',
  run: checkSchemaAnchorContract,
  renderSuccessMessage: ({ anchorCount }) => `Schema anchor contract is current (${anchorCount} anchors)`,
});
