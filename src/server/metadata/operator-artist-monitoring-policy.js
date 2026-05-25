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

export const operatorArtistMonitoringReleaseGroupTypes = Object.freeze([
  'album',
  'ep',
  'single',
  'compilation',
  'live',
  'other',
]);

export const operatorArtistMonitoringReleaseScopes = Object.freeze([
  'track_only',
  'future_only',
  'current_and_future',
]);

export const operatorArtistMonitoringWantedAutomationModes = Object.freeze([
  'manual_only',
  'future_matching',
  'current_and_future_matching',
]);

export const operatorArtistMonitoringAcquisitionProfileKeys = Object.freeze([
  'balanced_library',
  'lossless_archive',
  'apple_friendly_portable',
  'storage_saver',
]);

export const operatorArtistMonitoringSearchOnAddModes = Object.freeze([
  'none',
  'missing_now',
]);

export const operatorArtistMonitoringSelectionSourceModes = Object.freeze([
  'policy_only',
  'policy_plus_overrides',
]);

export const defaultOperatorArtistMonitoringPolicy = Object.freeze({
  acquisitionProfileKey: 'balanced_library',
  isMonitored: false,
  lastReconciledAt: null,
  lastSavedSnapshotAt: null,
  monitoredReleaseGroupTypes: ['album', 'ep'],
  releaseScope: 'future_only',
  searchOnAddMode: 'none',
  selectionSourceMode: 'policy_only',
  wantedAutomationMode: 'future_matching',
});

export function normalizeOperatorArtistMonitoringRow(row = {}) {
  return {
    acquisitionProfileKey: typeof row.acquisition_profile_key === 'string'
      ? row.acquisition_profile_key
      : (row.acquisitionProfileKey ?? defaultOperatorArtistMonitoringPolicy.acquisitionProfileKey),
    appUserId: row.app_user_id ?? row.appUserId ?? null,
    id: row.id ?? null,
    isMonitored: row.is_monitored === true || row.isMonitored === true,
    lastReconciledAt: row.last_reconciled_at?.toISOString?.() ?? row.lastReconciledAt ?? null,
    lastSavedSnapshotAt: row.last_saved_snapshot_at?.toISOString?.() ?? row.lastSavedSnapshotAt ?? null,
    metadataArtistId: row.metadata_artist_id ?? row.metadataArtistId ?? null,
    monitoredReleaseGroupTypes: Array.isArray(row.monitored_release_group_types)
      ? row.monitored_release_group_types
      : (Array.isArray(row.monitoredReleaseGroupTypes)
        ? row.monitoredReleaseGroupTypes
        : [...defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes]),
    releaseScope: typeof row.release_scope === 'string'
      ? row.release_scope
      : (row.releaseScope ?? defaultOperatorArtistMonitoringPolicy.releaseScope),
    searchOnAddMode: typeof row.search_on_add_mode === 'string'
      ? row.search_on_add_mode
      : (row.searchOnAddMode ?? defaultOperatorArtistMonitoringPolicy.searchOnAddMode),
    selectionSourceMode: typeof row.selection_source_mode === 'string'
      ? row.selection_source_mode
      : (row.selectionSourceMode ?? defaultOperatorArtistMonitoringPolicy.selectionSourceMode),
    wantedAutomationMode: typeof row.wanted_automation_mode === 'string'
      ? row.wanted_automation_mode
      : (row.wantedAutomationMode ?? defaultOperatorArtistMonitoringPolicy.wantedAutomationMode),
  };
}
