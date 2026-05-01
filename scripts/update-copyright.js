#!/usr/bin/env node
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  COPYRIGHT_YEAR,
  listCopyrightManagedFiles,
  updateCopyrightHeader,
} from './copyright-maintenance.js';

function main() {
  console.log(`\nUpdating copyright headers to ${COPYRIGHT_YEAR}...\n`);

  const files = listCopyrightManagedFiles();

  let added = 0;
  let updated = 0;

  files.forEach((file) => {
    const result = updateCopyrightHeader(file);
    if (result === 'added') {
      console.log(`  + ${file}`);
      added++;
    } else if (result === 'updated') {
      console.log(`  * ${file}`);
      updated++;
    }
  });

  console.log(`\nAdded headers to ${added} file(s), updated year/owner in ${updated} file(s)\n`);
}

main();
