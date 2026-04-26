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
const COPYRIGHT_YEAR = START_YEAR === CURRENT_YEAR ? `${START_YEAR}` : `${START_YEAR}-${CURRENT_YEAR}`;
const NEW_OWNER = 'Harmoniarr Contributors';

const FILE_PATTERNS = [
  'server/**/*.{js,jsx,ts,tsx}',
  'client/src/**/*.{js,jsx,ts,tsx}',
  'database/migrations/**/*.sql',
  'scripts/**/*.js'
];

const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'];

const HEADERS = {
  js: `/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) ${COPYRIGHT_YEAR} Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

`,
  sql: `-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) ${COPYRIGHT_YEAR} Harmoniarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

`
};

HEADERS.jsx = HEADERS.js;
HEADERS.ts = HEADERS.js;
HEADERS.tsx = HEADERS.js;

const COPYRIGHT_RE = /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Harmoniarr Contributors)/g;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('Copyright (C)')) {
    const ext = filePath.split('.').pop();
    const header = HEADERS[ext] || HEADERS.js;

    let newContent;
    if (content.startsWith('#!')) {
      const eol = content.indexOf('\n');
      if (eol !== -1) {
        newContent = content.substring(0, eol + 1) + header + content.substring(eol + 1);
      } else {
        newContent = `${content}\n${header}`;
      }
    } else {
      newContent = header + content;
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    return 'added';
  }

  const updated = content.replace(COPYRIGHT_RE, `Copyright (C) ${COPYRIGHT_YEAR} ${NEW_OWNER}`);
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return 'updated';
  }

  return null;
}

function main() {
  console.log(`\nUpdating copyright headers to ${COPYRIGHT_YEAR}...\n`);

  const files = FILE_PATTERNS.flatMap(pattern =>
    glob.sync(pattern, { nodir: true, ignore: IGNORE_PATTERNS })
  );

  let added = 0;
  let updated = 0;

  files.forEach(file => {
    const result = processFile(file);
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
