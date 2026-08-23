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

export const MUSIC_QUEUE_RELEASE_INSPECTOR_ID = 'music-queue-release-details';

export const MUSIC_QUEUE_WORKSPACE_LAYOUT = Object.freeze({
  INSPECTOR: 'with-inspector',
  LIST: 'list-only',
});

function normalizeReleaseId(value) {
  if (typeof value !== 'string') return null;

  const normalizedValue = value.trim();
  return normalizedValue || null;
}

/**
 * Derives the structural presentation of the Music Queue workspace. A
 * selected release is the only reason to reserve space for the inspector;
 * without one, the release list owns the whole workspace.
 *
 * @param {string | null | undefined} selectedReleaseId
 * @returns {{hasReleaseInspector: boolean, inspectorId: string, layout: 'list-only'|'with-inspector', selectedReleaseId: string | null}}
 */
export function buildMusicQueueWorkspacePresentation(selectedReleaseId) {
  const normalizedReleaseId = normalizeReleaseId(selectedReleaseId);
  const hasReleaseInspector = Boolean(normalizedReleaseId);

  return {
    hasReleaseInspector,
    inspectorId: MUSIC_QUEUE_RELEASE_INSPECTOR_ID,
    layout: hasReleaseInspector
      ? MUSIC_QUEUE_WORKSPACE_LAYOUT.INSPECTOR
      : MUSIC_QUEUE_WORKSPACE_LAYOUT.LIST,
    selectedReleaseId: normalizedReleaseId,
  };
}
