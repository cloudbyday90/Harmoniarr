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

import { buildMetadataReleaseGroupLocation } from './metadata-route-state.js';

/**
 * Returns a plain-language label for a monitoring decision recorded on a
 * detection event. Used in the release detection history panel.
 *
 * @param {string | null | undefined} decision
 * @returns {string}
 */
export function describeMonitoringDecision(decision) {
  switch (decision) {
    case 'wanted_release_detected':
      return 'A wanted release was detected for this monitoring policy.';
    case 'ignored_release_type':
      return 'Release type is not included in the monitoring policy.';
    case 'already_satisfied':
      return 'Catalog already has this release — no action needed.';
    default:
      return 'No monitoring action was taken.';
  }
}

/**
 * Returns a plain-language label for a wanted reconciliation status.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function describeWantedState(status) {
  switch (status) {
    case 'missing':
      return 'Missing';
    case 'partial':
      return 'Partial';
    default:
      return 'None';
  }
}

/**
 * Builds the monitoring patch payload that toggles the monitored flag and
 * preserves existing release group type preferences.
 *
 * @param {{ monitoring?: { isMonitored?: boolean, monitoredReleaseGroupTypes?: string[] } }} localArtist
 * @returns {{ isMonitored: boolean, monitoredReleaseGroupTypes: string[] }}
 */
export function buildNextMonitoringPatch(localArtist) {
  return {
    isMonitored: !(localArtist.monitoring?.isMonitored ?? false),
    monitoredReleaseGroupTypes: localArtist.monitoring?.monitoredReleaseGroupTypes ?? ['album', 'ep'],
  };
}

/**
 * Returns a link target for a detection event that points to the matching
 * release group workspace, or null if no link can be resolved.
 *
 * @param {{ artist?: { id?: string } }} localArtist
 * @param {{ metadataReleaseGroupId?: string }} event
 * @returns {{ label: string, to: import('vue-router').RouteLocationRaw } | null}
 */
export function detectionEventLinkTarget(localArtist, event) {
  const to = buildMetadataReleaseGroupLocation({
    artistId: localArtist.artist?.id,
    releaseGroupId: event.metadataReleaseGroupId,
  });

  if (!to) {
    return null;
  }

  return {
    label: 'Open release group',
    to,
  };
}
