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
import { ACTIVITY_DIAGNOSTIC_GROUPS } from '../../src/client/lib/activity-diagnostic-navigation.js';

test('Activity diagnostic navigation starts with recovery and keeps all destinations unique', () => {
  assert.deepEqual(
    ACTIVITY_DIAGNOSTIC_GROUPS.map((group) => group.title),
    ['Resolve an issue', 'Inspect music', 'Review records', 'Source and history'],
  );
  assert.deepEqual(
    ACTIVITY_DIAGNOSTIC_GROUPS[0].links.map((link) => link.name),
    ['activity-operations', 'activity-diagnostics-failed-library-adds'],
  );

  const routeNames = ACTIVITY_DIAGNOSTIC_GROUPS.flatMap((group) => group.links.map((link) => link.name));
  assert.equal(new Set(routeNames).size, routeNames.length);
  assert.equal(routeNames.includes('activity-candidates'), false);
  assert.equal(routeNames.includes('activity-imports'), false);
});
