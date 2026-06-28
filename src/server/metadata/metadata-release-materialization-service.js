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

import { createMetadataReadService } from './metadata-read-service.js';
import { createMusicBrainzCatalogService } from './musicbrainz-catalog-service.js';
import { createMusicBrainzImportService } from './musicbrainz-import-service.js';
import { markCanonicalRelease } from './canonical-release-service.js';

const COUNTRY_PREFERENCE = ['XW', 'GB', 'US'];
const DEFAULT_MAX_RELEASE_GROUPS_PER_REFRESH = 24;

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePrimaryType(primaryType) {
  return typeof primaryType === 'string' && primaryType.trim().length > 0
    ? primaryType.trim().toLowerCase()
    : 'other';
}

function createMonitoredReleaseGroupTypeSet(monitoringRows = []) {
  const types = new Set();

  for (const monitoring of monitoringRows) {
    if (monitoring?.isMonitored !== true || !Array.isArray(monitoring.monitoredReleaseGroupTypes)) {
      continue;
    }

    for (const type of monitoring.monitoredReleaseGroupTypes) {
      types.add(normalizePrimaryType(type));
    }
  }

  return types;
}

function releaseGroupHasCanonicalRelease({ releaseGroup, releases = [] }) {
  return releases.some((release) => (
    release?.releaseGroupId === releaseGroup.id
    && release.isCanonical === true
  ));
}

function releaseGroupHasAnyRelease({ releaseGroup, releases = [] }) {
  return releases.some((release) => release?.releaseGroupId === releaseGroup.id);
}

function getCountryRank(country) {
  const rank = COUNTRY_PREFERENCE.indexOf(country ?? '');
  return rank === -1 ? COUNTRY_PREFERENCE.length : rank;
}

function compareNullableDates(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left < right ? -1 : 1;
}

export function selectMaterializationReleaseCandidate(releases = []) {
  const candidates = releases.filter((release) => typeof release?.musicbrainzReleaseId === 'string'
    && release.musicbrainzReleaseId.length > 0);

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftOfficial = left.status === 'Official' ? 0 : 1;
    const rightOfficial = right.status === 'Official' ? 0 : 1;
    if (leftOfficial !== rightOfficial) {
      return leftOfficial - rightOfficial;
    }

    const dateComparison = compareNullableDates(left.releaseDate, right.releaseDate);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    const countryComparison = getCountryRank(left.country) - getCountryRank(right.country);
    if (countryComparison !== 0) {
      return countryComparison;
    }

    return (left.title ?? '').localeCompare(right.title ?? '');
  })[0];
}

export function createMetadataReleaseMaterializationService({
  getMetadataArtist = null,
  importMusicBrainzRelease = null,
  markCanonicalReleaseFn = markCanonicalRelease,
  maxReleaseGroupsPerRefresh = process.env.METADATA_RELEASE_MATERIALIZATION_MAX_GROUPS_PER_REFRESH,
  musicBrainzCatalogService = null,
  metadataReadService = null,
  musicBrainzImportService = null,
} = {}) {
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService();
  const resolvedMusicBrainzCatalogService = musicBrainzCatalogService ?? createMusicBrainzCatalogService();
  const resolvedMusicBrainzImportService = musicBrainzImportService ?? createMusicBrainzImportService();
  const readMetadataArtist = getMetadataArtist ?? resolvedMetadataReadService.getArtist;
  const importRelease = importMusicBrainzRelease ?? resolvedMusicBrainzImportService.importReleaseById;
  const effectiveMaxReleaseGroupsPerRefresh = parsePositiveInteger(
    maxReleaseGroupsPerRefresh,
    DEFAULT_MAX_RELEASE_GROUPS_PER_REFRESH,
  );

  async function materializeMonitoredReleaseGroups({
    metadataArtistId,
    monitoringRows = [],
    throwIfCancelled = async () => {},
  } = {}) {
    if (!metadataArtistId) {
      return {
        eligibleReleaseGroupCount: 0,
        importedReleaseCount: 0,
        skippedExistingCanonicalCount: 0,
        skippedExistingReleaseCount: 0,
        skippedNoCandidateCount: 0,
      };
    }

    const monitoredTypes = createMonitoredReleaseGroupTypeSet(monitoringRows);
    if (monitoredTypes.size < 1) {
      return {
        eligibleReleaseGroupCount: 0,
        importedReleaseCount: 0,
        skippedExistingCanonicalCount: 0,
        skippedExistingReleaseCount: 0,
        skippedNoCandidateCount: 0,
      };
    }

    await throwIfCancelled();
    const artistPayload = await readMetadataArtist({ artistId: metadataArtistId });
    const releaseGroups = Array.isArray(artistPayload?.releaseGroups) ? artistPayload.releaseGroups : [];
    const releases = Array.isArray(artistPayload?.releases) ? artistPayload.releases : [];
    const eligibleReleaseGroups = releaseGroups
      .filter((releaseGroup) => monitoredTypes.has(normalizePrimaryType(releaseGroup?.primaryType)))
      .filter((releaseGroup) => releaseGroup?.source?.musicbrainzReleaseGroupId)
      .sort((left, right) => compareNullableDates(left.firstReleaseDate, right.firstReleaseDate)
        || (left.title ?? '').localeCompare(right.title ?? ''));

    let importedReleaseCount = 0;
    let skippedExistingCanonicalCount = 0;
    let skippedExistingReleaseCount = 0;
    let skippedNoCandidateCount = 0;

    for (const releaseGroup of eligibleReleaseGroups.slice(0, effectiveMaxReleaseGroupsPerRefresh)) {
      await throwIfCancelled();

      if (releaseGroupHasCanonicalRelease({ releaseGroup, releases })) {
        skippedExistingCanonicalCount += 1;
        continue;
      }

      if (releaseGroupHasAnyRelease({ releaseGroup, releases })) {
        await markCanonicalReleaseFn(releaseGroup.id);
        skippedExistingReleaseCount += 1;
        continue;
      }

      const releasePage = await resolvedMusicBrainzCatalogService.getReleaseGroupReleases({
        releaseGroupId: releaseGroup.source.musicbrainzReleaseGroupId,
        limit: 25,
        offset: 0,
      });
      const candidate = selectMaterializationReleaseCandidate(releasePage.results ?? []);

      if (!candidate) {
        skippedNoCandidateCount += 1;
        continue;
      }

      const imported = await importRelease({
        releaseId: candidate.musicbrainzReleaseId,
        actorUserId: null,
        requestMetadata: null,
      });
      await markCanonicalReleaseFn(imported?.releaseGroup?.id ?? releaseGroup.id);
      importedReleaseCount += 1;
    }

    return {
      eligibleReleaseGroupCount: eligibleReleaseGroups.length,
      importedReleaseCount,
      skippedExistingCanonicalCount,
      skippedExistingReleaseCount,
      skippedNoCandidateCount,
    };
  }

  return {
    materializeMonitoredReleaseGroups,
  };
}
