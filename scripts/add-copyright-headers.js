#!/usr/bin/env node
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { addCopyrightHeader, listCopyrightManagedFiles } from './copyright-maintenance.js';

function main() {
  console.log('\nAdding copyright headers to files without them...\n');

  const files = listCopyrightManagedFiles();
  let added = 0;

  files.forEach((file) => {
    if (addCopyrightHeader(file)) {
      console.log(`  + ${file}`);
      added++;
    }
  });

  console.log(`\nAdded headers to ${added} file(s)\n`);
}

main();
