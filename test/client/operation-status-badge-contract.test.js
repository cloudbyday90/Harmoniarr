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

const BADGE_PATH = new URL('../../src/client/components/OperationStatusBadge.vue', import.meta.url);
const OPERATIONS_VIEW_PATH = new URL('../../src/client/views/OperationsView.vue', import.meta.url);
const JOB_DETAIL_PATH = new URL('../../src/client/components/OperationJobDetailPanel.vue', import.meta.url);
const ACTIVITY_QUEUE_PATH = new URL('../../src/client/views/ActivityQueueView.vue', import.meta.url);

test('OperationStatusBadge centralises tone + label for both vocabularies', async () => {
  const source = await readFile(BADGE_PATH, 'utf8');

  // Declares the public contract.
  assert.match(source, /status:\s*\{/, 'badge should declare a "status" prop');
  assert.match(source, /variant:\s*\{/, 'badge should declare a "variant" prop');
  assert.match(source, /unknownLabel:\s*\{/, 'badge should declare an "unknownLabel" prop');
  assert.match(source, /value === 'run' \|\| value === 'queue'/, 'variant must be validated');

  // Maps each vocabulary to the single source-of-truth helpers.
  assert.match(source, /formatOperationRunStatusTone/);
  assert.match(source, /getOperationRunStatusLabel/);
  assert.match(source, /formatQueueRunStatusTone/);
  assert.match(source, /formatQueueRunStatusLabel/);

  // Renders the design-system pill primitive.
  assert.match(source, /class="hx-pill"/);
});

test('OperationsView renders status through OperationStatusBadge, not inline pills', async () => {
  const source = await readFile(OPERATIONS_VIEW_PATH, 'utf8');

  assert.match(source, /import OperationStatusBadge from '\.\.\/components\/OperationStatusBadge\.vue'/);
  assert.match(source, /<OperationStatusBadge[^>]*variant="run"/);
  assert.match(source, /<OperationStatusBadge[^>]*variant="queue"/);
  assert.match(source, /unknown-label="Never run"/);

  // The hand-assembled pills must be gone.
  assert.doesNotMatch(source, /data-tone="formatOperationRunStatusTone/);
  assert.doesNotMatch(source, /data-tone="formatQueueRunStatusTone/);
});

test('Job detail and activity queue reuse the shared status badge', async () => {
  const detailSource = await readFile(JOB_DETAIL_PATH, 'utf8');
  assert.match(detailSource, /import OperationStatusBadge from '\.\/OperationStatusBadge\.vue'/);
  assert.match(detailSource, /<OperationStatusBadge[^>]*variant="run"/);
  assert.doesNotMatch(detailSource, /data-tone="formatOperationRunStatusTone/);

  const queueSource = await readFile(ACTIVITY_QUEUE_PATH, 'utf8');
  assert.match(queueSource, /import OperationStatusBadge from '\.\.\/components\/OperationStatusBadge\.vue'/);
  assert.match(queueSource, /<OperationStatusBadge[^>]*variant="queue"/);
  assert.doesNotMatch(queueSource, /data-tone="formatQueueRunStatusTone/);
});
