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

import { createMusicQueueReleaseMutationGate } from '../../src/client/lib/music-queue-release-mutation-gate.js';
import { createMissingMusicReleaseMutationGate } from '../../src/client/lib/missing-music-release-mutation-gate.js';

test('Missing Music mutation gate retains the legacy export identity', () => {
  assert.equal(
    createMusicQueueReleaseMutationGate,
    createMissingMusicReleaseMutationGate,
  );
});

test('Missing Music mutation gate permits one active release action and only its owner can release it', () => {
  const gate = createMissingMusicReleaseMutationGate();

  assert.equal(gate.acquire(' wanted-1 '), true);
  assert.equal(gate.getActiveWantedReleaseId(), 'wanted-1');
  assert.equal(gate.acquire('wanted-1'), false);
  assert.equal(gate.acquire('wanted-2'), false);
  assert.equal(gate.release('wanted-2'), false);
  assert.equal(gate.getActiveWantedReleaseId(), 'wanted-1');
  assert.equal(gate.release('wanted-1'), true);
  assert.equal(gate.getActiveWantedReleaseId(), '');
  assert.equal(gate.acquire('wanted-2'), true);
});

test('Missing Music mutation gate rejects blank release identifiers', () => {
  const gate = createMissingMusicReleaseMutationGate();

  assert.equal(gate.acquire(), false);
  assert.equal(gate.acquire('   '), false);
  assert.equal(gate.getActiveWantedReleaseId(), '');
  assert.equal(gate.release('wanted-1'), false);
});
