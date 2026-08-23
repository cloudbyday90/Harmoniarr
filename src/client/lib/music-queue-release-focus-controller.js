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

export const MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN = Object.freeze({
  DIRECT: 'direct',
  ROW: 'row',
});

function normalizeReleaseId(value) {
  if (typeof value !== 'string') return null;

  const normalizedValue = value.trim();
  return normalizedValue || null;
}

/**
 * Records how a selected Music Queue release was opened so the non-modal
 * inspector can preserve or restore an intentional focus location. Route
 * selection stays authoritative; this controller only retains ephemeral UI
 * context and never serializes a DOM element into route state.
 */
export function createMusicQueueReleaseFocusController() {
  let selectedRelease = null;
  let focusedDirectReleaseId = null;

  function selectFromRow({ releaseId, trigger = null } = {}) {
    const normalizedReleaseId = normalizeReleaseId(releaseId);
    if (!normalizedReleaseId) {
      selectedRelease = null;
      focusedDirectReleaseId = null;
      return null;
    }

    selectedRelease = {
      origin: MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.ROW,
      releaseId: normalizedReleaseId,
      trigger,
    };
    focusedDirectReleaseId = null;
    return selectedRelease;
  }

  function synchronizeRouteSelection(releaseId) {
    const normalizedReleaseId = normalizeReleaseId(releaseId);
    if (!normalizedReleaseId) {
      selectedRelease = null;
      focusedDirectReleaseId = null;
      return null;
    }

    if (
      selectedRelease?.origin === MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.ROW
      && selectedRelease.releaseId === normalizedReleaseId
    ) {
      return selectedRelease;
    }

    selectedRelease = {
      origin: MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.DIRECT,
      releaseId: normalizedReleaseId,
      trigger: null,
    };
    focusedDirectReleaseId = null;
    return selectedRelease;
  }

  function shouldFocusDirectInspectorHeading({
    isLoading = false,
    isReady = false,
    releaseId,
  } = {}) {
    const normalizedReleaseId = normalizeReleaseId(releaseId);
    if (
      selectedRelease?.origin !== MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.DIRECT
      || selectedRelease.releaseId !== normalizedReleaseId
      || isLoading
      || !isReady
      || focusedDirectReleaseId === normalizedReleaseId
    ) {
      return false;
    }

    focusedDirectReleaseId = normalizedReleaseId;
    return true;
  }

  function takeCloseFocusTarget(fallbackTarget = null) {
    const trigger = selectedRelease?.origin === MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.ROW
      ? selectedRelease.trigger
      : null;
    selectedRelease = null;
    focusedDirectReleaseId = null;
    return trigger ?? fallbackTarget;
  }

  function getSelection() {
    return selectedRelease;
  }

  return {
    getSelection,
    selectFromRow,
    shouldFocusDirectInspectorHeading,
    synchronizeRouteSelection,
    takeCloseFocusTarget,
  };
}
