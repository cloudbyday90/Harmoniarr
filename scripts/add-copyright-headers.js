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

const FILE_PATTERNS = [
  'server/**/*.{js,jsx,ts,tsx}',
  'client/src/**/*.{js,jsx,ts,tsx}',
  'database/migrations/**/*.sql',
  'scripts/**/*.js',
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/build/**'
];

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

function hasHeader(content) {
  return content.includes('Copyright (C)');
}

function addHeader(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (hasHeader(content)) {
    return false;
  }

  const ext = filePath.split('.').pop();
  const header = HEADERS[ext] || HEADERS.js;

  let newContent;
  if (content.startsWith('#!')) {
    const firstLineEnd = content.indexOf('\n');
    if (firstLineEnd !== -1) {
      const shebang = content.substring(0, firstLineEnd + 1);
      const restOfContent = content.substring(firstLineEnd + 1);
      newContent = shebang + header + restOfContent;
    } else {
      newContent = `${content}\n${header}`;
    }
  } else {
    newContent = header + content;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function main() {
  console.log('\nAdding copyright headers to files without them...\n');

  const files = FILE_PATTERNS.flatMap(pattern => glob.sync(pattern)).filter(f => fs.statSync(f).isFile());
  let added = 0;

  files.forEach(file => {
    if (addHeader(file)) {
      console.log(`  + ${file}`);
      added++;
    }
  });

  console.log(`\nAdded headers to ${added} file(s)\n`);
}

main();
