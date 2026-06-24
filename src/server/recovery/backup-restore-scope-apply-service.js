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

function normalizeScopeList(scopes) {
  if (!Array.isArray(scopes)) {
    return ['settings'];
  }

  const normalized = scopes
    .filter((scope) => typeof scope === 'string' && scope.trim().length > 0)
    .map((scope) => scope.trim());

  return normalized.length > 0 ? [...new Set(normalized)] : ['settings'];
}

function mergeSettingsPatch(target, patch) {
  const nextTarget = target;
  for (const [namespace, namespacePatch] of Object.entries(patch)) {
    if (!namespacePatch || typeof namespacePatch !== 'object' || Array.isArray(namespacePatch)) {
      continue;
    }

    nextTarget[namespace] = {
      ...(nextTarget[namespace] ?? {}),
      ...namespacePatch,
    };
  }

  return nextTarget;
}

const settingsBackedScopes = new Set([
  'settings',
  'providers',
  'pathMappings',
  'mediaManagement',
  'qualityProfiles',
]);

function normalizeOperatorMonitoringRows(operatorArtistMonitoring) {
  if (!Array.isArray(operatorArtistMonitoring)) {
    return null;
  }

  return operatorArtistMonitoring
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      acquisitionProfileKey: row.acquisitionProfileKey ?? 'balanced_library',
      appUserId: row.appUserId,
      isMonitored: row.isMonitored === true,
      lastReconciledAt: row.lastReconciledAt ?? null,
      lastSavedSnapshotAt: row.lastSavedSnapshotAt ?? null,
      metadataArtistId: row.metadataArtistId,
      monitoredReleaseGroupTypes: Array.isArray(row.monitoredReleaseGroupTypes)
        ? row.monitoredReleaseGroupTypes
        : ['album', 'ep'],
      releaseScope: row.releaseScope ?? 'future_only',
      searchOnAddMode: row.searchOnAddMode ?? 'none',
      selectionSourceMode: row.selectionSourceMode ?? 'policy_only',
      wantedAutomationMode: row.wantedAutomationMode ?? 'future_matching',
    }))
    .filter((row) => (
      typeof row.appUserId === 'string'
      && row.appUserId.trim().length > 0
      && typeof row.metadataArtistId === 'string'
      && row.metadataArtistId.trim().length > 0
    ));
}

function normalizeOperatorReleaseGroupSelectionRows(operatorReleaseGroupSelections) {
  if (!Array.isArray(operatorReleaseGroupSelections)) {
    return null;
  }

  return operatorReleaseGroupSelections
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      appUserId: row.appUserId,
      metadataArtistId: row.metadataArtistId,
      metadataReleaseGroupId: row.metadataReleaseGroupId,
      resolvedMetadataReleaseId: row.resolvedMetadataReleaseId ?? null,
      selectionSource: row.selectionSource ?? 'manual',
      selectionState: row.selectionState ?? 'selected',
    }))
    .filter((row) => (
      typeof row.appUserId === 'string'
      && row.appUserId.trim().length > 0
      && typeof row.metadataArtistId === 'string'
      && row.metadataArtistId.trim().length > 0
      && typeof row.metadataReleaseGroupId === 'string'
      && row.metadataReleaseGroupId.trim().length > 0
    ));
}

function normalizeOperatorTrackOverrideRows(operatorTrackOverrides) {
  if (!Array.isArray(operatorTrackOverrides)) {
    return null;
  }

  return operatorTrackOverrides
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      appUserId: row.appUserId,
      isDesired: row.isDesired === true,
      mediumPosition: row.mediumPosition ?? null,
      metadataArtistId: row.metadataArtistId,
      metadataReleaseGroupId: row.metadataReleaseGroupId,
      metadataReleaseId: row.metadataReleaseId ?? null,
      recordingMbid: row.recordingMbid ?? null,
      remapStatus: row.remapStatus ?? 'resolved',
      trackLengthMsSnapshot: row.trackLengthMsSnapshot ?? null,
      trackMbid: row.trackMbid ?? null,
      trackPosition: row.trackPosition ?? null,
      trackTitleSnapshot: row.trackTitleSnapshot ?? null,
    }))
    .filter((row) => (
      typeof row.appUserId === 'string'
      && row.appUserId.trim().length > 0
      && typeof row.metadataArtistId === 'string'
      && row.metadataArtistId.trim().length > 0
      && typeof row.metadataReleaseGroupId === 'string'
      && row.metadataReleaseGroupId.trim().length > 0
    ));
}

function normalizeWantedRows(wantedReleases) {
  if (!Array.isArray(wantedReleases)) {
    return null;
  }

  return wantedReleases
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      appUserId: row.appUserId,
      evidence: row.evidence ?? {},
      expectedTrackCount: Number.parseInt(row.expectedTrackCount, 10) || 0,
      matchedTrackCount: Number.parseInt(row.matchedTrackCount, 10) || 0,
      metadataArtistId: row.metadataArtistId,
      metadataReleaseGroupId: row.metadataReleaseGroupId,
      metadataReleaseId: row.metadataReleaseId,
      missingTrackCount: Number.parseInt(row.missingTrackCount, 10) || 0,
      releaseDate: row.releaseDate ?? null,
      releaseStatus: row.releaseStatus ?? null,
      wantedStatus: row.wantedStatus,
    }))
    .filter((row) => (
      typeof row.appUserId === 'string'
      && row.appUserId.trim().length > 0
      && typeof row.metadataArtistId === 'string'
      && row.metadataArtistId.trim().length > 0
      && typeof row.metadataReleaseGroupId === 'string'
      && row.metadataReleaseGroupId.trim().length > 0
      && typeof row.metadataReleaseId === 'string'
      && row.metadataReleaseId.trim().length > 0
      && typeof row.wantedStatus === 'string'
      && row.wantedStatus.trim().length > 0
    ));
}

function normalizeSnapshotRows(rows) {
  if (!Array.isArray(rows)) {
    return null;
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({ ...row }));
}

export function createBackupRestoreScopeApplyService({
  replaceOverridesSnapshot = async () => {},
  replaceLibraryWantedReleases = async () => {},
  replaceOperatorArtistMonitoring = async () => {},
  replaceOperatorReleaseGroupSelections = async () => {},
  replaceOperatorTrackOverrides = async () => {},
  replaceTrustSnapshot = async () => {},
  updateSettingsFn = async () => {
    throw new Error('updateSettingsFn dependency is required');
  },
} = {}) {
  async function applyRestoreScopes({
    artifactScope,
    parsedPayload,
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    const requestedScopes = normalizeScopeList(artifactScope);
    const scopeSettings = parsedPayload?.data?.scopeSettings;
    const settingsPayload = parsedPayload?.data?.settings;

    const appliedScopes = [];
    const skippedScopes = [];

    const settingsPatch = {};
    const settingsCandidateScopes = [];

    let wantedUpdated = false;
    let monitoringUpdated = false;
    let trustUpdated = false;
    let overridesUpdated = false;

    for (const scope of requestedScopes) {
      if (settingsBackedScopes.has(scope)) {
        const scopedPatch = scopeSettings?.[scope];
        if (scopedPatch && typeof scopedPatch === 'object' && !Array.isArray(scopedPatch)) {
          mergeSettingsPatch(settingsPatch, scopedPatch);
          settingsCandidateScopes.push(scope);
          continue;
        }

        if (
          scope === 'settings'
          && settingsPayload
          && typeof settingsPayload === 'object'
          && !Array.isArray(settingsPayload)
        ) {
          mergeSettingsPatch(settingsPatch, settingsPayload);
          settingsCandidateScopes.push(scope);
          continue;
        }

        skippedScopes.push(scope);
        continue;
      }

      if (scope === 'wanted') {
        const wantedReleases = normalizeWantedRows(scopeSettings?.wanted?.wantedReleases);
        if (!wantedReleases || wantedReleases.length < 1) {
          skippedScopes.push(scope);
          continue;
        }

        await replaceLibraryWantedReleases({ wantedReleases });
        wantedUpdated = true;
        appliedScopes.push(scope);
        continue;
      }

      if (scope === 'monitoring') {
        const operatorArtistMonitoring = normalizeOperatorMonitoringRows(
          scopeSettings?.monitoring?.operatorArtistMonitoring,
        );
        const operatorReleaseGroupSelections = normalizeOperatorReleaseGroupSelectionRows(
          scopeSettings?.monitoring?.operatorReleaseGroupSelections,
        );
        const operatorTrackOverrides = normalizeOperatorTrackOverrideRows(
          scopeSettings?.monitoring?.operatorTrackOverrides,
        );
        if (
          !operatorArtistMonitoring
          && !operatorReleaseGroupSelections
          && !operatorTrackOverrides
        ) {
          skippedScopes.push(scope);
          continue;
        }

        if (operatorArtistMonitoring) {
          await replaceOperatorArtistMonitoring({ operatorArtistMonitoring });
        }
        if (operatorReleaseGroupSelections) {
          await replaceOperatorReleaseGroupSelections({ operatorReleaseGroupSelections });
        }
        if (operatorTrackOverrides) {
          await replaceOperatorTrackOverrides({ operatorTrackOverrides });
        }
        monitoringUpdated = true;
        appliedScopes.push(scope);
        continue;
      }

      if (scope === 'trust') {
        const sourceUsers = normalizeSnapshotRows(scopeSettings?.trust?.sourceUsers);
        if (!sourceUsers) {
          skippedScopes.push(scope);
          continue;
        }

        await replaceTrustSnapshot({ sourceUsers });
        trustUpdated = true;
        appliedScopes.push(scope);
        continue;
      }

      if (scope === 'overrides') {
        const manualOverrides = normalizeSnapshotRows(scopeSettings?.overrides?.manualOverrides);
        if (!manualOverrides) {
          skippedScopes.push(scope);
          continue;
        }

        await replaceOverridesSnapshot({ manualOverrides });
        overridesUpdated = true;
        appliedScopes.push(scope);
        continue;
      }

      skippedScopes.push(scope);
    }

    let settingsUpdated = false;
    if (settingsCandidateScopes.length > 0) {
      await updateSettingsFn({
        actorUserId: triggeredByUserId,
        patch: settingsPatch,
        requestMetadata,
      });
      settingsUpdated = true;
      appliedScopes.push(...settingsCandidateScopes);
    }

    return {
      appliedScopes,
      monitoringUpdated,
      overridesUpdated,
      requestedScopes,
      settingsUpdated,
      skippedScopes,
      trustUpdated,
      wantedUpdated,
    };
  }

  return {
    applyRestoreScopes,
  };
}
