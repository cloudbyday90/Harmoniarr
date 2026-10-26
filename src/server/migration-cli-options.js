/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { parseArgs } from 'node:util';

export function parseMigrationCliOptions(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, strict: true, allowPositionals: false,
    options: { 'retry-failed': { type: 'boolean', default: false } } });
  return { retryFailedMigrations: values['retry-failed'] };
}
