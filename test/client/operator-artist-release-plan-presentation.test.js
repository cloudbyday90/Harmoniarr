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

import { formatOperatorArtistReleasePlanActivity } from '../../src/client/lib/operator-artist-release-plan-presentation.js';

test('Artist Detail gives completed release-plan work a quiet timestamp', () => {
  const now = Date.parse('2026-08-26T14:02:00.000Z');

  assert.equal(
    formatOperatorArtistReleasePlanActivity({
      latestSnapshot: { createdAt: '2026-08-26T14:00:00.000Z' },
      status: 'completed',
    }, { nowFn: () => now }),
    'Release plan updated 2m ago.',
  );
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'completed' }),
    'Release plan updated.',
  );
});

test('Artist Detail uses plain-language release-plan activity states', () => {
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'running' }),
    'Release plan update is running.',
  );
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'queued' }),
    'Release plan update is queued.',
  );
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'failed' }),
    'Release plan update needs attention.',
  );
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'cancelled' }),
    'Release plan update stopped.',
  );
  assert.equal(
    formatOperatorArtistReleasePlanActivity({ status: 'idle' }),
    'Release plan has not been updated yet.',
  );
});
