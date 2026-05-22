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
  buildReleaseActivityPresentation,
  getReleaseActivityEntityArtist,
  getReleaseActivityEntityTitle,
} from '../../shared/release-activity-presentation.js';

export function buildReleaseAddedActivityEvent({
  artistName = null,
  entityId = null,
  entityType = null,
  fallbackEntityTitle = null,
  movedCount = null,
  operationType = null,
  releaseCount = null,
  releases = [],
  releaseTitle = null,
  runId = null,
} = {}) {
  const presentation = buildReleaseActivityPresentation({
    artistName,
    movedCount,
    releaseCount,
    releases,
    releaseTitle,
    source: {
      operationType,
      runId,
    },
  });

  return {
    actorUserId: null,
    entityArtist: getReleaseActivityEntityArtist(presentation),
    entityId,
    entityTitle: getReleaseActivityEntityTitle(presentation) ?? fallbackEntityTitle,
    entityType,
    eventType: 'release_added',
    extraPayload: presentation,
  };
}
