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
  const trackOverrideCount = releaseGroup?.operatorState?.trackOverrideSummary?.totalCount ?? 0;
  const reviewNeededCount = releaseGroup?.operatorState?.trackOverrideSummary?.reviewNeededCount ?? 0;

  if (state !== policyState) {
    if (state === 'partial') return 'Manual partial selection';
    if (state === 'selected') return 'Manual inclusion';
    return 'Manual exclusion';
  }

  if (trackOverrideCount > 0) {
    return reviewNeededCount > 0
      ? `${trackOverrideCount} track override${trackOverrideCount === 1 ? '' : 's'} need review`
      : `${trackOverrideCount} track override${trackOverrideCount === 1 ? '' : 's'}`;
  }

  return 'Policy default';
}
