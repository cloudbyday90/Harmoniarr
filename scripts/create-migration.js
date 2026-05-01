/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { joinPositionalArguments } from './script-arguments.js';
import { runDirectScriptTask } from './script-runtime.js';

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('') + '_' + [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

async function createMigrationFile() {
  const description = joinPositionalArguments();

  if (!description.trim()) {
    throw new Error('Usage: npm run migration:create -- <description>');
  }

  const slug = slugify(description);
  if (!slug) {
    throw new Error('Description must contain at least one alphanumeric character.');
  }

  const migrationDirectory = resolve(process.cwd(), 'src/server/migrations');
  await mkdir(migrationDirectory, { recursive: true });

  const filename = `${formatTimestamp(new Date())}_${slug}.sql`;
  const filePath = resolve(migrationDirectory, filename);
  const handle = await open(filePath, 'wx');

  try {
    await handle.writeFile('-- forward-only migration\nBEGIN;\n\nCOMMIT;\n');
  } finally {
    await handle.close();
  }

  return filename;
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-create-migration',
  renderSuccessMessage: (filename) => filename,
  run: createMigrationFile,
  stdoutStyle: 'raw',
});
