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

import {
  buildMetadataArtistLocation,
  buildMetadataReleaseGroupLocation,
} from './metadata-route-state.js';
import {
  buildOperationRunLinkTarget,
  buildOperationRunLinkTargetFromEvent,
} from './operation-run-link-targets.js';

export function buildActivityFeedEntryLinkTarget(entry = {}) {
  if (entry.entryType === 'operation') {
    return buildOperationRunLinkTarget({
      operationType: entry.operationType,
      runId: entry.runId,
    });
  }

  if (entry.entryType !== 'audit') {
    return null;
  }

  if (entry.metadataArtistId && entry.metadataReleaseGroupId) {
    return {
      label: 'Open metadata release group',
      to: buildMetadataReleaseGroupLocation({
        artistId: entry.metadataArtistId,
        releaseGroupId: entry.metadataReleaseGroupId,
      }),
    };
  }

  if (entry.metadataArtistId) {
    return {
      label: 'Open metadata artist',
      to: buildMetadataArtistLocation(entry.metadataArtistId),
    };
  }

  if (entry.entityId && entry.eventType) {
    return buildOperationRunLinkTargetFromEvent({
      entityId: entry.entityId,
      eventType: entry.eventType,
    });
  }

  return null;
}