/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { migrationFilenamePattern } from '../src/server/migration-manifest.js';
import { runDirectScriptTask } from './script-runtime.js';

async function checkMigrationFilenames() {
  const targetMigrationDirectory = resolve(process.cwd(), 'src/server/migrations');
  const entries = await readdir(targetMigrationDirectory, { withFileTypes: true });
  const invalid = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .filter((name) => !migrationFilenamePattern.test(name));

  if (invalid.length > 0) {
    throw new Error(`Invalid migration filenames:\n${invalid.map((name) => `- ${name}`).join('\n')}`);
  }
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-migration-filenames',
  renderSuccessMessage: () => 'Migration filenames are valid.',
  run: checkMigrationFilenames,
});
