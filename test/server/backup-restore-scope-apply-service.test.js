import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupRestoreScopeApplyService } from '../../src/server/recovery/backup-restore-scope-apply-service.js';

test('applyRestoreScopes applies settings-backed scopes, wanted, and monitoring payloads', async (t) => {
  const updateSettingsFn = t.mock.fn(async () => {});
  const replaceOverridesSnapshot = t.mock.fn(async () => {});
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const replaceOperatorArtistMonitoring = t.mock.fn(async () => {});
  const replaceOperatorReleaseGroupSelections = t.mock.fn(async () => {});
  const replaceOperatorTrackOverrides = t.mock.fn(async () => {});
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createBackupRestoreScopeApplyService({
    replaceOverridesSnapshot,
    replaceLibraryWantedReleases,
    replaceOperatorArtistMonitoring,
    replaceOperatorReleaseGroupSelections,
    replaceOperatorTrackOverrides,
    replaceTrustSnapshot,
    updateSettingsFn,
  });

  const result = await service.applyRestoreScopes({
    artifactScope: ['providers', 'monitoring', 'wanted', 'trust', 'overrides', 'settings'],
    parsedPayload: {
      data: {
        scopeSettings: {
          providers: {
            providers: {
              spotifyEnabled: true,
            },
          },
          monitoring: {
            operatorArtistMonitoring: [
              {
                acquisitionProfileKey: 'balanced_library',
                appUserId: 'user-1',
                isMonitored: true,
                metadataArtistId: 'artist-1',
                monitoredReleaseGroupTypes: ['album', 'single'],
                releaseScope: 'future_only',
                searchOnAddMode: 'none',
                selectionSourceMode: 'policy_plus_overrides',
                wantedAutomationMode: 'future_matching',
              },
            ],
            operatorReleaseGroupSelections: [
              {
                appUserId: 'user-1',
                metadataArtistId: 'artist-1',
                metadataReleaseGroupId: 'release-group-1',
                resolvedMetadataReleaseId: 'release-1',
                selectionOrigin: 'manual_inclusion',
                selectionSource: 'manual',
                selectionState: 'partial',
              },
            ],
            operatorTrackOverrides: [
              {
                appUserId: 'user-1',
                isDesired: true,
                mediumPosition: 1,
                metadataArtistId: 'artist-1',
                metadataReleaseGroupId: 'release-group-1',
                metadataReleaseId: 'release-1',
                recordingMbid: '11111111-1111-4111-8111-111111111111',
                remapStatus: 'resolved',
                trackLengthMsSnapshot: 215000,
                trackMbid: '22222222-2222-4222-8222-222222222222',
                trackPosition: 4,
                trackTitleSnapshot: 'Example Song',
              },
            ],
          },
          wanted: {
            wantedReleases: [
              {
                appUserId: 'user-1',
                metadataArtistId: 'artist-1',
                metadataReleaseGroupId: 'rg-1',
                metadataReleaseId: 'release-1',
                wantedStatus: 'missing',
                expectedTrackCount: 12,
                matchedTrackCount: 0,
                missingTrackCount: 12,
              },
            ],
          },
          trust: {
            sourceUsers: [
              {
                username: 'trusted-uploader',
                trustState: 'trusted',
              },
            ],
          },
          overrides: {
            manualOverrides: [
              {
                scope: 'release',
                targetId: 'release-1',
                decision: 'prefer',
              },
            ],
          },
        },
        settings: {
          system: {
            logLevel: 'debug',
          },
        },
      },
    },
    requestMetadata: {
      ipAddress: '198.51.100.90',
      userAgent: 'restore-scope-test',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(updateSettingsFn.mock.callCount(), 1);
  assert.equal(replaceOverridesSnapshot.mock.callCount(), 1);
  assert.equal(replaceLibraryWantedReleases.mock.callCount(), 1);
  assert.equal(
    replaceLibraryWantedReleases.mock.calls[0].arguments[0].wantedReleases[0].appUserId,
    'user-1',
  );
  assert.equal(replaceOperatorArtistMonitoring.mock.callCount(), 1);
  assert.equal(replaceOperatorReleaseGroupSelections.mock.callCount(), 1);
  assert.equal(
    replaceOperatorReleaseGroupSelections.mock.calls[0].arguments[0]
      .operatorReleaseGroupSelections[0].selectionOrigin,
    'manual_inclusion',
  );
  assert.equal(replaceOperatorTrackOverrides.mock.callCount(), 1);
  assert.equal(replaceTrustSnapshot.mock.callCount(), 1);
  assert.deepEqual(result, {
    appliedScopes: ['monitoring', 'wanted', 'trust', 'overrides', 'providers', 'settings'],
    monitoringUpdated: true,
    overridesUpdated: true,
    requestedScopes: ['providers', 'monitoring', 'wanted', 'trust', 'overrides', 'settings'],
    settingsUpdated: true,
    skippedScopes: [],
    trustUpdated: true,
    wantedUpdated: true,
  });
});

test('applyRestoreScopes skips unsupported and missing scope payloads', async () => {
  const service = createBackupRestoreScopeApplyService({
    updateSettingsFn: async () => {},
  });

  const result = await service.applyRestoreScopes({
    artifactScope: ['overrides', 'trust', 'monitoring'],
    parsedPayload: {
      data: {
        scopeSettings: {
          providers: {
            providers: {
              spotifyEnabled: true,
            },
          },
        },
      },
    },
  });

  assert.deepEqual(result, {
    appliedScopes: [],
    monitoringUpdated: false,
    overridesUpdated: false,
    requestedScopes: ['overrides', 'trust', 'monitoring'],
    settingsUpdated: false,
    skippedScopes: ['overrides', 'trust', 'monitoring'],
    trustUpdated: false,
    wantedUpdated: false,
  });
});

test('applyRestoreScopes skips ownerless wanted rows', async (t) => {
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const service = createBackupRestoreScopeApplyService({
    replaceLibraryWantedReleases,
    updateSettingsFn: async () => {},
  });

  const result = await service.applyRestoreScopes({
    artifactScope: ['wanted'],
    parsedPayload: {
      data: {
        scopeSettings: {
          wanted: {
            wantedReleases: [{
              metadataArtistId: 'artist-1',
              metadataReleaseGroupId: 'rg-1',
              metadataReleaseId: 'release-1',
              wantedStatus: 'missing',
            }],
          },
        },
      },
    },
  });

  assert.equal(replaceLibraryWantedReleases.mock.callCount(), 0);
  assert.deepEqual(result, {
    appliedScopes: [],
    monitoringUpdated: false,
    overridesUpdated: false,
    requestedScopes: ['wanted'],
    settingsUpdated: false,
    skippedScopes: ['wanted'],
    trustUpdated: false,
    wantedUpdated: false,
  });
});
