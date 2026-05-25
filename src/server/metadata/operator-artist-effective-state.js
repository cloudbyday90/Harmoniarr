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

export function normalizeReleaseGroupPrimaryType(primaryType) {
  if (typeof primaryType !== 'string' || primaryType.trim().length === 0) {
    return 'other';
  }

  return primaryType.trim().toLowerCase();
}

function createReleaseLookup(releases = []) {
  return new Map(releases.map((release) => [release.id, release]));
}

function createCanonicalReleaseLookup(releases = []) {
  const lookup = new Map();

  for (const release of releases) {
    if (release?.releaseGroupId && release?.isCanonical === true) {
      lookup.set(release.releaseGroupId, release);
    }
  }

  return lookup;
}

function createOverrideBucketsByReleaseGroup(trackOverrides = []) {
  const buckets = new Map();

  for (const trackOverride of trackOverrides) {
    const bucket = buckets.get(trackOverride.metadataReleaseGroupId) ?? [];
    bucket.push(trackOverride);
    buckets.set(trackOverride.metadataReleaseGroupId, bucket);
  }

  return buckets;
}

export function summarizeTrackOverrides(trackOverrides = []) {
  const desiredCount = trackOverrides.filter((trackOverride) => trackOverride.isDesired === true).length;
  const suppressedCount = trackOverrides.filter((trackOverride) => trackOverride.isDesired === false).length;
  const reviewNeededCount = trackOverrides.filter((trackOverride) => trackOverride.remapStatus === 'review_needed').length;
  const orphanedCount = trackOverrides.filter((trackOverride) => trackOverride.remapStatus === 'orphaned').length;

  return {
    desiredCount,
    orphanedCount,
    reviewNeededCount,
    suppressedCount,
    totalCount: trackOverrides.length,
  };
}

function deriveSelectionState({
  canonicalRelease,
  explicitSelection = null,
  monitoredReleaseGroupTypes = [],
  releaseGroup,
}) {
  if (explicitSelection) {
    return {
      isExplicit: true,
      resolvedMetadataReleaseId: explicitSelection.resolvedMetadataReleaseId ?? canonicalRelease?.id ?? null,
      selectionSource: explicitSelection.selectionSource ?? 'manual',
      selectionState: explicitSelection.selectionState ?? 'selected',
    };
  }

  const primaryType = normalizeReleaseGroupPrimaryType(releaseGroup?.primaryType);
  const isSelectedByPolicy = monitoredReleaseGroupTypes.includes(primaryType);

  return {
    isExplicit: false,
    resolvedMetadataReleaseId: canonicalRelease?.id ?? null,
    selectionSource: 'policy',
    selectionState: isSelectedByPolicy ? 'selected' : 'unselected',
  };
}

export function buildOperatorArtistEffectiveReleaseGroups({
  releaseGroupSelections = [],
  releaseGroups = [],
  releases = [],
  monitoredReleaseGroupTypes = [],
  trackOverrides = [],
}) {
  const releaseLookup = createReleaseLookup(releases);
  const canonicalReleaseLookup = createCanonicalReleaseLookup(releases);
  const releaseGroupSelectionLookup = new Map(
    releaseGroupSelections.map((selection) => [selection.metadataReleaseGroupId, selection]),
  );
  const overrideBucketsByReleaseGroup = createOverrideBucketsByReleaseGroup(trackOverrides);
  const releaseGroupIds = new Set(releaseGroups.map((releaseGroup) => releaseGroup.id));

  const effectiveReleaseGroups = releaseGroups.map((releaseGroup) => {
    const explicitSelection = releaseGroupSelectionLookup.get(releaseGroup.id) ?? null;
    const canonicalRelease = canonicalReleaseLookup.get(releaseGroup.id) ?? null;
    const selectionState = deriveSelectionState({
      canonicalRelease,
      explicitSelection,
      monitoredReleaseGroupTypes,
      releaseGroup,
    });
    const releaseGroupTrackOverrides = overrideBucketsByReleaseGroup.get(releaseGroup.id) ?? [];
    const resolvedRelease = selectionState.resolvedMetadataReleaseId
      ? (releaseLookup.get(selectionState.resolvedMetadataReleaseId) ?? null)
      : null;

    return {
      ...releaseGroup,
      operatorState: {
        isExplicitSelection: selectionState.isExplicit,
        resolvedMetadataReleaseId: selectionState.resolvedMetadataReleaseId,
        resolvedRelease,
        selectionSource: selectionState.selectionSource,
        selectionState: selectionState.selectionState,
        trackOverrideSummary: summarizeTrackOverrides(releaseGroupTrackOverrides),
      },
    };
  });

  return {
    effectiveReleaseGroups,
    orphanedReleaseGroupSelections: releaseGroupSelections.filter(
      (selection) => !releaseGroupIds.has(selection.metadataReleaseGroupId),
    ),
    orphanedTrackOverrides: trackOverrides.filter(
      (trackOverride) => !releaseGroupIds.has(trackOverride.metadataReleaseGroupId),
    ),
  };
}
