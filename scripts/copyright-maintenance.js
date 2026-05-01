/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import fs from 'node:fs';
import { globSync } from 'glob';

const START_YEAR = 2026;
const CURRENT_YEAR = new Date().getFullYear();

export const COPYRIGHT_YEAR = START_YEAR === CURRENT_YEAR ? `${START_YEAR}` : `${START_YEAR}-${CURRENT_YEAR}`;
export const COPYRIGHT_OWNER = 'Harmoniarr Contributors';
export const COPYRIGHT_PATTERN = /Copyright \(C\) (\d{4}|\d{4}-\d{4}) (cloudbyday90|Harmoniarr Contributors)/g;

const FILE_PATTERNS = [
  'src/server/**/*.{js,jsx,ts,tsx,sql}',
  'src/client/**/*.{js,jsx,ts,tsx,vue,css,html}',
  'scripts/**/*.js',
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
  html: `<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) ${COPYRIGHT_YEAR} Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

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

`,
};

HEADERS.jsx = HEADERS.js;
HEADERS.ts = HEADERS.js;
HEADERS.tsx = HEADERS.js;
HEADERS.css = HEADERS.js;
HEADERS.html = HEADERS.html;
HEADERS.vue = HEADERS.html;

export function listCopyrightManagedFiles({ glob = globSync } = {}) {
  return FILE_PATTERNS.flatMap((pattern) => glob(pattern, { nodir: true, ignore: IGNORE_PATTERNS }));
}

export function hasCopyrightHeader(content) {
  return content.includes('Copyright (C)');
}

export function getCopyrightHeader(filePath) {
  const extension = filePath.split('.').pop();
  return HEADERS[extension] || HEADERS.js;
}

export function insertCopyrightHeader(content, { filePath } = {}) {
  const header = getCopyrightHeader(filePath ?? 'unknown.js');

  if (content.startsWith('#!')) {
    const firstLineEnd = content.indexOf('\n');
    if (firstLineEnd !== -1) {
      const shebang = content.substring(0, firstLineEnd + 1);
      const restOfContent = content.substring(firstLineEnd + 1);
      return shebang + header + restOfContent;
    }

    return `${content}\n${header}`;
  }

  return header + content;
}

export function addCopyrightHeader(filePath, { fsModule = fs } = {}) {
  const content = fsModule.readFileSync(filePath, 'utf8');

  if (hasCopyrightHeader(content)) {
    return false;
  }

  fsModule.writeFileSync(filePath, insertCopyrightHeader(content, { filePath }), 'utf8');
  return true;
}

export function updateCopyrightHeader(filePath, {
  fsModule = fs,
  owner = COPYRIGHT_OWNER,
  year = COPYRIGHT_YEAR,
} = {}) {
  const content = fsModule.readFileSync(filePath, 'utf8');

  if (!hasCopyrightHeader(content)) {
    fsModule.writeFileSync(filePath, insertCopyrightHeader(content, { filePath }), 'utf8');
    return 'added';
  }

  const updated = content.replace(COPYRIGHT_PATTERN, `Copyright (C) ${year} ${owner}`);
  if (updated !== content) {
    fsModule.writeFileSync(filePath, updated, 'utf8');
    return 'updated';
  }

  return null;
}

export function checkCopyrightHeader(filePath, {
  expectedOwner = COPYRIGHT_OWNER,
  expectedYear = COPYRIGHT_YEAR,
  fsModule = fs,
} = {}) {
  const content = fsModule.readFileSync(filePath, 'utf8');
  const firstLines = content.split('\n').slice(0, 12).join('\n');

  const match = firstLines.match(COPYRIGHT_PATTERN);
  if (!match) {
    return { valid: false, reason: 'No copyright header found' };
  }

  if (!firstLines.includes(expectedYear)) {
    return { valid: false, reason: `Expected ${expectedYear}, found ${match[0]}` };
  }

  if (!firstLines.includes(expectedOwner)) {
    return { valid: false, reason: `Expected owner "${expectedOwner}"` };
  }

  return { valid: true };
}