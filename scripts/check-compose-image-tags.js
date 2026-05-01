/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { checkComposeImageTagPolicy } from './compose-image-tag-policy.js';
import { runDirectScriptTask } from './script-runtime.js';

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-compose-image-tags',
  renderSuccessMessage: ({ checkedFileCount }) => {
    return `Compose image tag policy passed for ${checkedFileCount} file${checkedFileCount === 1 ? '' : 's'}.`;
  },
  run: () => checkComposeImageTagPolicy(),
});