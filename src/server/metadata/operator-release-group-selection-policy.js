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

export const operatorReleaseGroupSelectionStates = Object.freeze([
  'unselected',
  'selected',
  'partial',
]);

export const operatorReleaseGroupSelectionSources = Object.freeze([
  'manual',
  'policy',
]);

export const operatorReleaseGroupSelectionOrigins = Object.freeze([
  'manual_edition',
  'manual_inclusion',
]);

export const defaultOperatorReleaseGroupSelectionPolicy = Object.freeze({
  resolvedMetadataReleaseId: null,
  selectionOrigin: null,
  selectionSource: 'manual',
  selectionState: 'selected',
});

export function normalizeOperatorReleaseGroupSelectionRow(row = {}) {
  return {
    appUserId: row.app_user_id ?? row.appUserId ?? null,
    id: row.id ?? null,
    metadataArtistId: row.metadata_artist_id ?? row.metadataArtistId ?? null,
    metadataReleaseGroupId: row.metadata_release_group_id ?? row.metadataReleaseGroupId ?? null,
    resolvedMetadataReleaseId: row.resolved_metadata_release_id ?? row.resolvedMetadataReleaseId ?? null,
    selectionOrigin: row.selection_origin ?? row.selectionOrigin ?? null,
    selectionSource: typeof row.selection_source === 'string'
      ? row.selection_source
      : (row.selectionSource ?? defaultOperatorReleaseGroupSelectionPolicy.selectionSource),
    selectionState: typeof row.selection_state === 'string'
      ? row.selection_state
      : (row.selectionState ?? defaultOperatorReleaseGroupSelectionPolicy.selectionState),
  };
}
