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

function normalizeWantedReleaseId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Keeps client-side Missing Music release mutations single-flight. The active
 * release identifier is intentionally exposed as plain state so a selected
 * inspector can consistently make competing actions unavailable before its
 * request begins. This is a usability guard; server authorization and
 * idempotency remain authoritative.
 */
export function createMissingMusicReleaseMutationGate() {
  let activeWantedReleaseId = '';

  function acquire(wantedReleaseId) {
    const normalizedWantedReleaseId = normalizeWantedReleaseId(wantedReleaseId);
    if (!normalizedWantedReleaseId || activeWantedReleaseId) {
      return false;
    }

    activeWantedReleaseId = normalizedWantedReleaseId;
    return true;
  }

  function release(wantedReleaseId) {
    const normalizedWantedReleaseId = normalizeWantedReleaseId(wantedReleaseId);
    if (!normalizedWantedReleaseId || activeWantedReleaseId !== normalizedWantedReleaseId) {
      return false;
    }

    activeWantedReleaseId = '';
    return true;
  }

  function getActiveWantedReleaseId() {
    return activeWantedReleaseId;
  }

  return {
    acquire,
    getActiveWantedReleaseId,
    release,
  };
}
