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

export const addArtistContentTypeOptions = Object.freeze([
  { label: 'Albums', value: 'album' },
  { label: 'EPs', value: 'ep' },
  { label: 'Singles', value: 'single' },
  { label: 'Compilations', value: 'compilation' },
  { label: 'Live', value: 'live' },
]);

export const addArtistReleaseScopeOptions = Object.freeze([
  {
    description: 'Track the artist without widening desired state automatically.',
    label: 'Track only',
    value: 'track_only',
  },
  {
    description: 'Future matching releases can participate in automation.',
    label: 'Future releases only',
    value: 'future_only',
  },
  {
    description: 'Known and future matching releases can participate in automation.',
    label: 'Current and future releases',
    value: 'current_and_future',
  },
]);

export const addArtistAcquisitionProfileOptions = Object.freeze([
  {
    description: 'Balance quality, compatibility, and storage for everyday listening.',
    label: 'Balanced library',
    value: 'balanced_library',
  },
  {
    description: 'Prefer highest-quality versions for long-term storage.',
    label: 'Lossless archive',
    value: 'lossless_archive',
  },
  {
    description: 'Favor Apple-friendly playback formats and practical portability.',
    label: 'Apple friendly portable',
    value: 'apple_friendly_portable',
  },
  {
    description: 'Minimize storage use while keeping acceptable playback quality.',
    label: 'Storage saver',
    value: 'storage_saver',
  },
]);

export const addArtistWantedAutomationOptions = Object.freeze([
  {
    description: 'Only explicit selections become wanted.',
    label: 'Do not mark wanted automatically',
    value: 'manual_only',
  },
  {
    description: 'Future matching releases become wanted after policy is saved.',
    label: 'Mark future matching releases as wanted',
    value: 'future_matching',
  },
  {
    description: 'Known and future matching releases become wanted after policy is saved.',
    label: 'Mark current and future matching releases as wanted',
    value: 'current_and_future_matching',
  },
]);

export const defaultAddArtistPolicyForm = Object.freeze({
  acquisitionProfileKey: 'balanced_library',
  monitoredReleaseGroupTypes: Object.freeze(['album', 'ep']),
  releaseScope: 'future_only',
  searchNow: false,
  useAsDefault: true,
  wantedAutomationMode: 'future_matching',
});

const savedAddArtistPolicyStorageKey = 'harmoniarr:add-artist-policy:v1';
const allowedContentTypes = new Set(addArtistContentTypeOptions.map((option) => option.value));
const allowedReleaseScopes = new Set(addArtistReleaseScopeOptions.map((option) => option.value));
const allowedAcquisitionProfiles = new Set(addArtistAcquisitionProfileOptions.map((option) => option.value));
const allowedWantedAutomationModes = new Set(addArtistWantedAutomationOptions.map((option) => option.value));

function normalizeEnumValue({ allowedValues, fallback, value }) {
  return typeof value === 'string' && allowedValues.has(value) ? value : fallback;
}

export function normalizeAddArtistPolicyForm(input = {}) {
  const monitoredReleaseGroupTypes = Array.isArray(input.monitoredReleaseGroupTypes)
    ? [...new Set(input.monitoredReleaseGroupTypes
      .map((entry) => String(entry).trim().toLowerCase())
      .filter((entry) => allowedContentTypes.has(entry)))]
    : [...defaultAddArtistPolicyForm.monitoredReleaseGroupTypes];

  return {
    acquisitionProfileKey: normalizeEnumValue({
      allowedValues: allowedAcquisitionProfiles,
      fallback: defaultAddArtistPolicyForm.acquisitionProfileKey,
      value: input.acquisitionProfileKey,
    }),
    monitoredReleaseGroupTypes: monitoredReleaseGroupTypes.length > 0
      ? monitoredReleaseGroupTypes
      : [...defaultAddArtistPolicyForm.monitoredReleaseGroupTypes],
    releaseScope: normalizeEnumValue({
      allowedValues: allowedReleaseScopes,
      fallback: defaultAddArtistPolicyForm.releaseScope,
      value: input.releaseScope,
    }),
    searchNow: input.searchNow === true,
    useAsDefault: input.useAsDefault !== false,
    wantedAutomationMode: normalizeEnumValue({
      allowedValues: allowedWantedAutomationModes,
      fallback: defaultAddArtistPolicyForm.wantedAutomationMode,
      value: input.wantedAutomationMode,
    }),
  };
}

export function buildOperatorArtistDraftFromAddPolicy(policyForm = {}) {
  const normalized = normalizeAddArtistPolicyForm(policyForm);

  return {
    monitoring: {
      acquisitionProfileKey: normalized.acquisitionProfileKey,
      isMonitored: true,
      monitoredReleaseGroupTypes: normalized.monitoredReleaseGroupTypes,
      releaseScope: normalized.releaseScope,
      searchOnAddMode: normalized.searchNow ? 'missing_now' : 'none',
      selectionSourceMode: 'policy_only',
      wantedAutomationMode: normalized.wantedAutomationMode,
    },
    releaseGroupSelections: [],
    trackOverrides: [],
  };
}

export function loadSavedAddArtistPolicyForm({ storage = globalThis.localStorage } = {}) {
  if (!storage) {
    return normalizeAddArtistPolicyForm();
  }

  try {
    const rawValue = storage.getItem(savedAddArtistPolicyStorageKey);
    if (!rawValue) {
      return normalizeAddArtistPolicyForm();
    }

    return normalizeAddArtistPolicyForm(JSON.parse(rawValue));
  } catch {
    return normalizeAddArtistPolicyForm();
  }
}

export function saveAddArtistPolicyForm(policyForm = {}, { storage = globalThis.localStorage } = {}) {
  const normalized = normalizeAddArtistPolicyForm(policyForm);
  if (!storage) {
    return normalized;
  }

  storage.setItem(savedAddArtistPolicyStorageKey, JSON.stringify(normalized));
  return normalized;
}
