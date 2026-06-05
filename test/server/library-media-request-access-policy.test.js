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
import { canReadMediaRequest } from '../../src/server/library/library-media-request-access-policy.js';

const mediaRequest = {
  requestedByUser: { id: 'requester-1' },
  requestedForUser: { id: 'listener-1' },
};

test('canReadMediaRequest permits administrators', () => {
  assert.equal(canReadMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequest,
  }), true);
});

test('canReadMediaRequest permits the requesting and target users', () => {
  assert.equal(canReadMediaRequest({
    actorUserId: 'requester-1',
    actorUserRole: 'requester',
    mediaRequest,
  }), true);
  assert.equal(canReadMediaRequest({
    actorUserId: 'listener-1',
    actorUserRole: 'requester',
    mediaRequest,
  }), true);
});

test('canReadMediaRequest rejects unrelated or incomplete actors', () => {
  assert.equal(canReadMediaRequest({
    actorUserId: 'unrelated-1',
    actorUserRole: 'requester',
    mediaRequest,
  }), false);
  assert.equal(canReadMediaRequest({
    actorUserId: null,
    actorUserRole: 'admin',
    mediaRequest,
  }), false);
  assert.equal(canReadMediaRequest({
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    mediaRequest: null,
  }), false);
});
