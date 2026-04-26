#!/usr/bin/env node
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const fs = require('fs');
const glob = require('glob');

const START_YEAR = 2026;
const CURRENT_YEAR = new Date().getFullYear();
const EXPECTED_PATTERN = START_YEAR === CURRENT_YEAR ? `${START_YEAR}` : `${START_YEAR}-${CURRENT_YEAR}`;
const OWNER = 'Harmoniarr Contributors';
const COPYRIGHT_PATTERN = /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Harmoniarr Contributors)/g;

const FILE_PATTERNS = [
  'server/**/*.{js,jsx,ts,tsx}',
  'client/src/**/*.{js,jsx,ts,tsx}',
  'database/migrations/**/*.sql',
  'scripts/**/*.js'
];

const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLines = content.split('\n').slice(0, 12).join('\n');

  const match = firstLines.match(COPYRIGHT_PATTERN);
  if (!match) {
    return { valid: false, reason: 'No copyright header found' };
  }

  if (!firstLines.includes(EXPECTED_PATTERN)) {
    return { valid: false, reason: `Expected ${EXPECTED_PATTERN}, found ${match[0]}` };
  }

  if (!firstLines.includes(OWNER)) {
    return { valid: false, reason: `Expected owner "${OWNER}"` };
  }

  return { valid: true };
}

function main() {
  const files = FILE_PATTERNS.flatMap(pattern =>
    glob.sync(pattern, { nodir: true, ignore: IGNORE_PATTERNS })
  );
  const errors = [];

  files.forEach(file => {
    const result = checkFile(file);
    if (!result.valid) {
      errors.push(`${file}: ${result.reason}`);
    }
  });

  if (errors.length > 0) {
    console.error('\nCopyright compliance check FAILED\n');
    console.error(`Found ${errors.length} file(s) with outdated/missing copyright headers:\n`);
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nRun: npm run update-copyright\n');
    process.exit(1);
  }

  console.log(`Copyright compliance check PASSED (${files.length} files checked)`);
}

main();
