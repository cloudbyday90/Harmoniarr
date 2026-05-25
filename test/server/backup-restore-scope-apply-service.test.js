import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupRestoreScopeApplyService } from '../../src/server/recovery/backup-restore-scope-apply-service.js';

test('applyRestoreScopes applies settings-backed scopes, wanted, and monitoring payloads', async (t) => {
  const updateSettingsFn = t.mock.fn(async () => {});
  const replaceOverridesSnapshot = t.mock.fn(async () => {});
  const replaceLibraryWantedReleases = t.mock.fn(async () => {});
  const replaceMetadataArtistMonitoring = t.mock.fn(async () => {});
  const replaceOperatorArtistMonitoring = t.mock.fn(async () => {});
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createBackupRestoreScopeApplyService({
    replaceOverridesSnapshot,
    replaceLibraryWantedReleases,
    replaceMetadataArtistMonitoring,
    replaceOperatorArtistMonitoring,
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
            artistMonitoring: [
              {
                metadataArtistId: 'artist-1',
                isMonitored: true,
                monitoredReleaseGroupTypes: ['album'],
              },
            ],
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
          },
          wanted: {
            wantedReleases: [
              {
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
  assert.equal(replaceMetadataArtistMonitoring.mock.callCount(), 1);
  assert.equal(replaceOperatorArtistMonitoring.mock.callCount(), 1);
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
