/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
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

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const VIEW_PATH = new URL('../../src/client/views/ActivityImportsView.vue', import.meta.url);

test('ActivityImportsView imports every formatter used by the imports table template', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /candidateStatusLabel,/);
  assert.match(source, /candidateStatusTone,/);
  assert.match(source, /formatCandidateCountLabel,/);
  assert.match(source, /formatSourceProvider,/);
  assert.match(source, /from '\.\.\/lib\/import-candidate-presentation\.js'/);
  assert.match(source, /import \{ formatOperationTimestamp \} from '\.\.\/lib\/operation-run-presentation\.js'/);
  assert.match(source, /\{\{ formatCandidateCountLabel\(candidateCount\) \}\}/);
  assert.match(source, /\{\{ formatSourceProvider\(candidate\.sourceProvider\) \}\}/);
  assert.match(source, /candidateStatusTone\(candidate\.status\)/);
  assert.match(source, /candidateStatusLabel\(candidate\.status\)/);
  assert.match(source, /formatOperationTimestamp\(/);
});

