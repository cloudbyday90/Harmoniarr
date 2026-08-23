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
  buildMusicQueueWorkspacePresentation,
  MUSIC_QUEUE_RELEASE_INSPECTOR_ID,
  MUSIC_QUEUE_WORKSPACE_LAYOUT,
} from '../../src/client/lib/music-queue-workspace-presentation.js';

test('Music Queue gives the release list the full workspace until a release is selected', () => {
  assert.deepEqual(buildMusicQueueWorkspacePresentation(null), {
    hasReleaseInspector: false,
    inspectorId: MUSIC_QUEUE_RELEASE_INSPECTOR_ID,
    layout: MUSIC_QUEUE_WORKSPACE_LAYOUT.LIST,
    selectedReleaseId: null,
  });
  assert.deepEqual(buildMusicQueueWorkspacePresentation('   '), {
    hasReleaseInspector: false,
    inspectorId: MUSIC_QUEUE_RELEASE_INSPECTOR_ID,
    layout: MUSIC_QUEUE_WORKSPACE_LAYOUT.LIST,
    selectedReleaseId: null,
  });
});

test('Music Queue reserves an inspector only for a selected release', () => {
  assert.deepEqual(buildMusicQueueWorkspacePresentation(' wanted-quality '), {
    hasReleaseInspector: true,
    inspectorId: MUSIC_QUEUE_RELEASE_INSPECTOR_ID,
    layout: MUSIC_QUEUE_WORKSPACE_LAYOUT.INSPECTOR,
    selectedReleaseId: 'wanted-quality',
  });
});
