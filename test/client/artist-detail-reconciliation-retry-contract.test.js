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

const VIEW_PATH = new URL('../../src/client/views/ArtistDetailView.vue', import.meta.url);

test('ArtistDetailView exposes a failed reconciliation retry action without requiring policy changes', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /retryOperatorArtistReconciliation,/);
  assert.match(source, /const isRetryingReconciliation = ref\(false\)/);
  assert.match(source, /const reconciliationActionError = ref\(''\)/);
  assert.match(source, /const reconciliationActionStatus = ref\(''\)/);
  assert.match(source, /const canRetryOperatorReconciliation = computed/);
  assert.match(source, /operatorReconciliation\.value\?\.status === 'failed'/);
  assert.match(source, /formatOperatorArtistReleasePlanActivity/);
  assert.match(source, /await retryOperatorArtistReconciliation\(projection\.value\.artist\.id\)/);
  assert.match(source, /reconciliationActionStatus\.value = 'Release plan update queued\.'/);
  assert.match(source, /await loadArtistDetail\(mbid\.value\)/);
  assert.match(source, /@click="retryReconciliation"/);
  assert.match(source, /Retry update/);
  assert.match(source, /role="status" aria-atomic="true"/);
});
