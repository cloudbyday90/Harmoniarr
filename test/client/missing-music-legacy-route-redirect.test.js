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
import test from 'node:test';
import {
  redirectLegacyAcquisitionDownloader,
  redirectLegacyMusicQueueRelease,
  redirectLegacyMusicQueueWorklist,
} from '../../src/client/lib/missing-music-legacy-route-redirect.js';

test('legacy Music Queue worklist redirects retain ordinary URL state', () => {
  const query = { accountStatus: 'disabled', q: 'amber' };

  assert.deepEqual(
    redirectLegacyMusicQueueWorklist({ hash: '#results', query }),
    { hash: '#results', name: 'missing', query },
  );
});

test('legacy Music Queue release redirects use the opaque decision route and retain URL state', () => {
  const query = { state: 'action', view: 'details' };

  assert.deepEqual(
    redirectLegacyMusicQueueRelease({
      hash: '#current-status',
      params: { wantedReleaseId: ' wanted-amber ' },
      query,
    }),
    {
      hash: '#current-status',
      name: 'missing-decision',
      params: { decisionId: 'wanted-amber' },
      query,
    },
  );
});

test('malformed legacy release IDs fall back to the scoped Missing Music worklist', () => {
  assert.deepEqual(
    redirectLegacyMusicQueueRelease({
      params: { wantedReleaseId: 'x'.repeat(201) },
      query: { requestedForUserId: 'not-authority' },
    }),
    {
      hash: '',
      name: 'missing',
      query: { requestedForUserId: 'not-authority' },
    },
  );
});

test('legacy Acquisition Downloader redirects retain URL state without changing its authorization policy', () => {
  const query = { missingMusicDecisionId: 'wanted-amber' };

  assert.deepEqual(
    redirectLegacyAcquisitionDownloader({ hash: '#transfer-1', query }),
    { hash: '#transfer-1', name: 'downloader', query },
  );
});
