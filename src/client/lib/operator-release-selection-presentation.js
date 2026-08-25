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

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isManualSelection(selection = {}) {
  return normalizeToken(selection.selectionSource) === 'manual'
    && normalizeToken(selection.selectionState) !== 'unselected';
}

/**
 * Builds the concise, durable provenance status shared by Artist Detail and
 * Music Queue. A manual selection can originate from more than one command,
 * so the copy deliberately describes the saved state rather than guessing the
 * command that produced it.
 *
 * @param {{ selectionSource?: string, selectionState?: string } | null | undefined} selection
 * @returns {{ detail: string, label: string, tone: string } | null}
 */
export function buildOperatorReleaseSelectionPresentation(selection = {}) {
  if (!isManualSelection(selection)) {
    return null;
  }

  if (normalizeToken(selection.selectionState) === 'partial') {
    return {
      detail: 'Tracks are selected manually for this release group.',
      label: 'Manual partial selection',
      tone: 'info',
    };
  }

  return {
    detail: 'A saved edition will be used in Music Queue.',
    label: 'Manual selection',
    tone: 'info',
  };
}

/**
 * Produces a short status message only when a saved manual selection has
 * reconciliation work that explains a visible state change. This is a status,
 * not a promise that a search or download has started.
 *
 * @param {{ operatorState?: object, reconciliation?: { status?: string } } | null | undefined} input
 * @returns {{ detail: string, label: string, tone: string } | null}
 */
export function buildOperatorReleaseReconciliationPresentation({
  operatorState = {},
  reconciliation = {},
} = {}) {
  if (!isManualSelection(operatorState)) {
    return null;
  }

  switch (normalizeToken(reconciliation.status)) {
    case 'pending':
    case 'queued':
      return {
        detail: 'Music Queue will update when reconciliation begins.',
        label: 'Latest save queued',
        tone: 'info',
      };
    case 'running':
      return {
        detail: 'Reconciliation is preparing this saved selection for Music Queue.',
        label: 'Updating Music Queue',
        tone: 'info',
      };
    case 'failed':
      return {
        detail: 'Use Retry reconciliation at the top of this page to try again.',
        label: 'Update did not finish',
        tone: 'danger',
      };
    default:
      return null;
  }
}

/**
 * Finds the user-scoped Music Queue release for one metadata release group.
 * IDs, rather than artist or title strings, are used for the correlation so a
 * release title with alternate editions cannot open the wrong queue entry.
 *
 * @param {Array<{ metadataReleaseGroupId?: string }>} releases
 * @param {string | null | undefined} metadataReleaseGroupId
 * @returns {object | null}
 */
export function findMusicQueueReleaseForReleaseGroup(releases, metadataReleaseGroupId) {
  if (typeof metadataReleaseGroupId !== 'string' || metadataReleaseGroupId.trim().length === 0) {
    return null;
  }

  const normalizedReleaseGroupId = metadataReleaseGroupId.trim();
  return (Array.isArray(releases) ? releases : []).find(
    (release) => release?.metadataReleaseGroupId === normalizedReleaseGroupId,
  ) ?? null;
}
