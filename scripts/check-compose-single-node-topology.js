/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { checkComposeSingleNodeTopologyPolicy } from './compose-single-node-topology-policy.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-compose-single-node-topology',
  renderSuccessMessage: ({ checkedFileCount }) => {
    return `Compose single-node topology policy passed for ${checkedFileCount} file${checkedFileCount === 1 ? '' : 's'}.`;
  },
  run: () => checkComposeSingleNodeTopologyPolicy(),
});
