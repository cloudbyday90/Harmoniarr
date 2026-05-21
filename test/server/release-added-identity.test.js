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
import { buildReleaseAddedCooldownKey } from '../../src/server/notification/release-added-identity.js';

test('buildReleaseAddedCooldownKey prefers canonical artist and release identity', () => {
  const importKey = buildReleaseAddedCooldownKey({
    artistName: 'Radiohead',
    fallbackKey: 'uploader1:/music/album',
    releaseTitle: 'OK Computer',
  });
  const organizeKey = buildReleaseAddedCooldownKey({
    artistName: '  radiohead  ',
    fallbackKey: '1:2',
    releaseTitle: 'ok   computer',
  });

  assert.equal(importKey, 'releaseAdded:canonical:radiohead:ok computer');
  assert.equal(organizeKey, importKey);
});

test('buildReleaseAddedCooldownKey falls back when canonical release identity is unavailable', () => {
  assert.equal(
    buildReleaseAddedCooldownKey({ fallbackKey: 'uploader1:/music/album' }),
    'releaseAdded:fallback:uploader1:/music/album',
  );
});
