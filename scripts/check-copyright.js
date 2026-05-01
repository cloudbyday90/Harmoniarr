#!/usr/bin/env node
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runDirectScriptTask } from './script-runtime.js';
import {
  checkCopyrightHeader,
  listCopyrightManagedFiles,
} from './copyright-maintenance.js';

async function checkCopyrightCompliance() {
  const files = listCopyrightManagedFiles();
  const errors = [];

  files.forEach((file) => {
    const result = checkCopyrightHeader(file);
    if (!result.valid) {
      errors.push(`${file}: ${result.reason}`);
    }
  });

  if (errors.length > 0) {
    throw new Error([
      'Copyright compliance check FAILED',
      '',
      `Found ${errors.length} file(s) with outdated/missing copyright headers:`,
      '',
      ...errors.map((error) => `  - ${error}`),
      '',
      'Run: npm run update-copyright',
    ].join('\n'));
  }

  return {
    checkedFileCount: files.length,
  };
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-copyright',
  renderSuccessMessage: ({ checkedFileCount }) => {
    return `Copyright compliance check passed (${checkedFileCount} files checked)`;
  },
  run: checkCopyrightCompliance,
});
