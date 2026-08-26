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
import { buildAcquisitionWorkspaceSections } from '../../src/client/lib/acquisition-workspace-presentation.js';

test('Acquisition sections keep release work and transfer work together for administrators', () => {
  assert.deepEqual(buildAcquisitionWorkspaceSections(true), [
    { name: 'acquisition', label: 'Overview' },
    { name: 'acquisition-music-queue', label: 'Music Queue' },
    { name: 'acquisition-downloader', label: 'Downloader' },
  ]);
});

test('Acquisition sections omit the protected Downloader destination for non-administrators', () => {
  assert.deepEqual(buildAcquisitionWorkspaceSections(false), [
    { name: 'acquisition', label: 'Overview' },
    { name: 'acquisition-music-queue', label: 'Music Queue' },
  ]);
});

test('Acquisition sections are immutable across callers', () => {
  const sections = buildAcquisitionWorkspaceSections(false);
  assert.equal(Object.isFrozen(sections), true);
  assert.equal(Object.isFrozen(sections[0]), true);
});
