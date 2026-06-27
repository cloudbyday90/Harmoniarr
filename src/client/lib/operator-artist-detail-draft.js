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

import { defaultAddArtistPolicyForm, normalizeAddArtistPolicyForm } from './add-artist-policy.js';
import {
  summarizeTrackOverrideRemapReview,
} from './operator-track-override-remap-review.js';

const defaultMonitoring = Object.freeze({
  acquisitionProfileKey: defaultAddArtistPolicyForm.acquisitionProfileKey,
  isMonitored: true,
  monitoredReleaseGroupTypes: defaultAddArtistPolicyForm.monitoredReleaseGroupTypes,
  releaseScope: defaultAddArtistPolicyForm.releaseScope,
  searchOnAddMode: 'none',
  selectionSourceMode: 'policy_only',
  wantedAutomationMode: defaultAddArtistPolicyForm.wantedAutomationMode,
});

const selectableStates = new Set(['unselected', 'selected', 'partial']);
const trackOverrideStates = new Set(['policy', 'desired', 'suppressed']);

function normalizeNullableString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullablePositiveInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMonitoring(monitoring = {}) {
  const normalizedPolicy = normalizeAddArtistPolicyForm({
    acquisitionProfileKey: monitoring.acquisitionProfileKey,
    monitoredReleaseGroupTypes: monitoring.monitoredReleaseGroupTypes,
    releaseScope: monitoring.releaseScope,
    wantedAutomationMode: monitoring.wantedAutomationMode,
  });

  return {
    ...defaultMonitoring,
    ...normalizedPolicy,
    isMonitored: monitoring.isMonitored !== false,
    searchOnAddMode: typeof monitoring.searchOnAddMode === 'string' ? monitoring.searchOnAddMode : 'none',
    selectionSourceMode: monitoring.selectionSourceMode === 'policy_plus_overrides'
      ? 'policy_plus_overrides'
      : 'policy_only',
  };
}

function normalizeReleaseGroupSelection(selection = {}) {
  const selectionState = selectableStates.has(selection.selectionState)
    ? selection.selectionState
    : 'selected';

  return {
    metadataReleaseGroupId: selection.metadataReleaseGroupId,
    resolvedMetadataReleaseId: selection.resolvedMetadataReleaseId ?? null,
    selectionSource: 'manual',
    selectionState,
  };
}

function normalizeTrackOverride(override = {}) {
  return {
    isDesired: override.isDesired === true,
    mediumPosition: override.mediumPosition ?? null,
    metadataReleaseGroupId: override.metadataReleaseGroupId,
    metadataReleaseId: override.metadataReleaseId ?? null,
    recordingMbid: override.recordingMbid ?? null,
    remapStatus: override.remapStatus ?? 'resolved',
    trackLengthMsSnapshot: override.trackLengthMsSnapshot ?? null,
    trackMbid: override.trackMbid ?? null,
    trackPosition: override.trackPosition ?? null,
    trackTitleSnapshot: override.trackTitleSnapshot ?? null,
  };
}

export function buildDraftTrackOverrideIdentity(releaseGroup, track, context = {}) {
  const metadataReleaseGroupId = normalizeNullableString(releaseGroup?.id ?? context.metadataReleaseGroupId);
  const trackMbid = normalizeNullableString(
    track?.trackMbid ?? track?.musicbrainzTrackId ?? track?.musicbrainzTrackMbid,
  );
  const recordingMbid = normalizeNullableString(track?.recordingMbid ?? context.recordingMbid);
  const mediumPosition = normalizeNullablePositiveInteger(context.mediumPosition ?? track?.mediumPosition);
  const trackPosition = normalizeNullablePositiveInteger(context.trackPosition ?? track?.position);

  if (!metadataReleaseGroupId) {
    return null;
  }

  if (!trackMbid && (!recordingMbid || mediumPosition == null || trackPosition == null)) {
    return null;
  }

  return {
    mediumPosition,
    metadataReleaseGroupId,
    metadataReleaseId: normalizeNullableString(context.metadataReleaseId),
    recordingMbid,
    trackMbid,
    trackPosition,
  };
}

function isSameTrackOverrideIdentity(override, identity) {
  if (!override || !identity || override.metadataReleaseGroupId !== identity.metadataReleaseGroupId) {
    return false;
  }

  if (identity.trackMbid) {
    return override.trackMbid === identity.trackMbid;
  }

  return (override.trackMbid ?? null) === null
    && override.recordingMbid === identity.recordingMbid
    && override.mediumPosition === identity.mediumPosition
    && override.trackPosition === identity.trackPosition
    && (override.metadataReleaseId ?? null) === (identity.metadataReleaseId ?? null);
}

function buildDraftTrackOverrideIdentityFromOverride(override) {
  if (!override?.metadataReleaseGroupId) {
    return null;
  }

  if (override.trackMbid) {
    return {
      mediumPosition: null,
      metadataReleaseGroupId: override.metadataReleaseGroupId,
      metadataReleaseId: null,
      recordingMbid: null,
      trackMbid: override.trackMbid,
      trackPosition: null,
    };
  }

  if (!override.recordingMbid || override.mediumPosition == null || override.trackPosition == null) {
    return null;
  }

  return {
    mediumPosition: override.mediumPosition,
    metadataReleaseGroupId: override.metadataReleaseGroupId,
    metadataReleaseId: override.metadataReleaseId ?? null,
    recordingMbid: override.recordingMbid,
    trackMbid: null,
    trackPosition: override.trackPosition,
  };
}

function findDraftTrackOverrideIndex(draft, releaseGroup, track, context = {}) {
  const identity = buildDraftTrackOverrideIdentity(releaseGroup, track, context);
  if (!identity) return -1;

  return (draft?.trackOverrides ?? [])
    .findIndex((override) => isSameTrackOverrideIdentity(override, identity));
}

export function getDraftTrackOverride(draft, releaseGroup, track, context = {}) {
  const overrideIndex = findDraftTrackOverrideIndex(draft, releaseGroup, track, context);
  if (overrideIndex < 0) return null;
  return draft.trackOverrides[overrideIndex] ?? null;
}

export function getDraftReleaseGroupTrackOverrides(draft, releaseGroup) {
  return (draft?.trackOverrides ?? [])
    .filter((trackOverride) => trackOverride.metadataReleaseGroupId === releaseGroup?.id);
}

export function getDraftReleaseGroupTrackOverrideReviewSummary(draft, releaseGroup) {
  return summarizeTrackOverrideRemapReview(
    getDraftReleaseGroupTrackOverrides(draft, releaseGroup),
  );
}

export function hasDraftReleaseGroupTrackOverrideReview(draft, releaseGroup) {
  return getDraftReleaseGroupTrackOverrideReviewSummary(draft, releaseGroup).hasReview;
}

export function removeDraftTrackOverride(draft, trackOverride) {
  if (!draft || !trackOverride) {
    return draft;
  }

  const identity = buildDraftTrackOverrideIdentityFromOverride(trackOverride);
  if (!identity) {
    return draft;
  }

  draft.trackOverrides = (draft.trackOverrides ?? [])
    .filter((override) => !isSameTrackOverrideIdentity(override, identity));
  return draft;
}

export function resolveDraftTrackOverrideRemapReview(draft, trackOverride) {
  if (!draft || !trackOverride) {
    return draft;
  }

  const identity = buildDraftTrackOverrideIdentityFromOverride(trackOverride);
  if (!identity) {
    return draft;
  }

  draft.trackOverrides = (draft.trackOverrides ?? [])
    .map((override) => isSameTrackOverrideIdentity(override, identity)
      ? normalizeTrackOverride({ ...override, remapStatus: 'resolved' })
      : override);
  return draft;
}

export function createOperatorArtistDetailDraft(projection = {}) {
  const operator = projection?.operator ?? {};
  return {
    monitoring: normalizeMonitoring(operator.monitoring),
    releaseGroupSelections: Array.isArray(operator.releaseGroupSelections)
      ? operator.releaseGroupSelections.map(normalizeReleaseGroupSelection)
      : [],
    trackOverrides: Array.isArray(operator.trackOverrides)
      ? operator.trackOverrides.map(normalizeTrackOverride)
      : [],
  };
}

export function isReleaseGroupSelectedByPolicy(draft, releaseGroup) {
  const type = String(releaseGroup?.primaryType ?? '').trim().toLowerCase();
  return (draft?.monitoring?.monitoredReleaseGroupTypes ?? []).includes(type);
}

export function getExplicitReleaseGroupSelection(draft, releaseGroupId) {
  return (draft?.releaseGroupSelections ?? [])
    .find((selection) => selection.metadataReleaseGroupId === releaseGroupId) ?? null;
}

export function getDraftReleaseGroupSelectionState(draft, releaseGroup) {
  const explicitSelection = getExplicitReleaseGroupSelection(draft, releaseGroup?.id);
  if (explicitSelection) {
    return explicitSelection.selectionState;
  }

  return isReleaseGroupSelectedByPolicy(draft, releaseGroup) ? 'selected' : 'unselected';
}

export function setDraftReleaseGroupSelectionState(draft, releaseGroup, selectionState) {
  if (!draft || !releaseGroup?.id || !selectableStates.has(selectionState)) {
    return draft;
  }

  const isPolicySelected = isReleaseGroupSelectedByPolicy(draft, releaseGroup);
  const policyState = isPolicySelected ? 'selected' : 'unselected';
  const nextSelections = (draft.releaseGroupSelections ?? [])
    .filter((selection) => selection.metadataReleaseGroupId !== releaseGroup.id);

  if (selectionState !== policyState) {
    nextSelections.push(normalizeReleaseGroupSelection({
      metadataReleaseGroupId: releaseGroup.id,
      resolvedMetadataReleaseId: releaseGroup.operatorState?.resolvedMetadataReleaseId ?? null,
      selectionState,
    }));
  }

  draft.releaseGroupSelections = nextSelections;
  return draft;
}

export function canBuildDraftTrackOverride(releaseGroup, track, context = {}) {
  return buildDraftTrackOverrideIdentity(releaseGroup, track, context) !== null;
}

export function getDraftTrackOverrideState(draft, releaseGroup, track, context = {}) {
  const override = getDraftTrackOverride(draft, releaseGroup, track, context);
  if (!override) return 'policy';
  return override.isDesired ? 'desired' : 'suppressed';
}

export function setDraftTrackOverrideState(draft, releaseGroup, track, overrideState, context = {}) {
  if (!draft || !trackOverrideStates.has(overrideState)) {
    return draft;
  }

  const identity = buildDraftTrackOverrideIdentity(releaseGroup, track, context);
  if (!identity) {
    return draft;
  }

  const existingOverrides = Array.isArray(draft.trackOverrides) ? draft.trackOverrides : [];
  const existingOverride = existingOverrides
    .find((override) => isSameTrackOverrideIdentity(override, identity));
  const nextOverrides = existingOverrides
    .filter((override) => !isSameTrackOverrideIdentity(override, identity));

  if (overrideState !== 'policy') {
    nextOverrides.push(normalizeTrackOverride({
      ...existingOverride,
      ...identity,
      isDesired: overrideState === 'desired',
      remapStatus: existingOverride?.remapStatus ?? 'resolved',
      trackLengthMsSnapshot: track.lengthMs ?? existingOverride?.trackLengthMsSnapshot ?? null,
      trackTitleSnapshot: track.title ?? existingOverride?.trackTitleSnapshot ?? null,
    }));
  }

  draft.trackOverrides = nextOverrides;
  return draft;
}

export function buildOperatorArtistSaveDraft(draft = {}) {
  const normalizedDraft = {
    monitoring: normalizeMonitoring(draft.monitoring),
    releaseGroupSelections: Array.isArray(draft.releaseGroupSelections)
      ? draft.releaseGroupSelections.map(normalizeReleaseGroupSelection)
      : [],
    trackOverrides: Array.isArray(draft.trackOverrides)
      ? draft.trackOverrides.map(normalizeTrackOverride)
      : [],
  };
  const releaseGroupSelections = normalizedDraft.monitoring.isMonitored
    ? normalizedDraft.releaseGroupSelections
    : [];
  const trackOverrides = normalizedDraft.monitoring.isMonitored
    ? normalizedDraft.trackOverrides
    : [];
  const hasOverrides = releaseGroupSelections.length > 0 || trackOverrides.length > 0;

  return {
    monitoring: {
      ...normalizedDraft.monitoring,
      selectionSourceMode: hasOverrides ? 'policy_plus_overrides' : 'policy_only',
    },
    releaseGroupSelections,
    trackOverrides,
  };
}

export function fingerprintOperatorArtistDraft(draft = {}) {
  return JSON.stringify(buildOperatorArtistSaveDraft(draft));
}

export function describeReleaseGroupOverride(draft, releaseGroup) {
  const state = getDraftReleaseGroupSelectionState(draft, releaseGroup);
  const policyState = isReleaseGroupSelectedByPolicy(draft, releaseGroup) ? 'selected' : 'unselected';
  const draftReleaseGroupTrackOverrides = getDraftReleaseGroupTrackOverrides(draft, releaseGroup);
  const draftTrackOverrideCount = draftReleaseGroupTrackOverrides.length;
  const trackOverrideCount = draftTrackOverrideCount
    || releaseGroup?.operatorState?.trackOverrideSummary?.totalCount
    || 0;
  const savedTrackOverrideSummary = releaseGroup?.operatorState?.trackOverrideSummary ?? {};
  const reviewSummary = draftTrackOverrideCount > 0
    ? summarizeTrackOverrideRemapReview(draftReleaseGroupTrackOverrides)
    : {
      hasReview: Number(savedTrackOverrideSummary.reviewNeededCount ?? 0)
        + Number(savedTrackOverrideSummary.orphanedCount ?? 0) > 0,
    };

  if (state !== policyState) {
    if (state === 'partial') return 'Manual partial selection';
    if (state === 'selected') return 'Manual inclusion';
    return 'Manual exclusion';
  }

  if (trackOverrideCount > 0) {
    return reviewSummary.hasReview
      ? `${trackOverrideCount} track override${trackOverrideCount === 1 ? ' needs' : 's need'} review`
      : `${trackOverrideCount} track override${trackOverrideCount === 1 ? '' : 's'}`;
  }

  return 'Policy default';
}
