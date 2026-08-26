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

import { buildOperatorArtistCardStatusPresentation } from '../../src/client/lib/operator-artist-card-status-presentation.js';

test('Home card hides completed and inactive release-plan work', () => {
  assert.equal(buildOperatorArtistCardStatusPresentation({ status: 'completed' }), null);
  assert.equal(buildOperatorArtistCardStatusPresentation({ status: 'idle' }), null);
  assert.equal(buildOperatorArtistCardStatusPresentation(), null);
});

test('Home card describes only active and exceptional release-plan states', () => {
  assert.deepEqual(
    buildOperatorArtistCardStatusPresentation({ status: 'running' }),
    { label: 'Updating release plan', tone: 'warning' },
  );
  assert.deepEqual(
    buildOperatorArtistCardStatusPresentation({ status: 'PENDING' }),
    { label: 'Updating release plan', tone: 'warning' },
  );
  assert.deepEqual(
    buildOperatorArtistCardStatusPresentation({ status: 'failed' }),
    { label: 'Release plan update needs attention', tone: 'danger' },
  );
  assert.deepEqual(
    buildOperatorArtistCardStatusPresentation({ status: 'cancelled' }),
    { label: 'Release plan update stopped', tone: 'warning' },
  );
});
