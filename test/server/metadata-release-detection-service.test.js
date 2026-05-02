import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataReleaseDetectionService } from '../../src/server/metadata/metadata-release-detection-service.js';

test('metadata release detection service records detection decisions and audit events', async (t) => {
  const listWantedStatusesForReleaseGroups = t.mock.fn(async () => [{
    metadataReleaseGroupId: 'local-rg-2',
    wantedStatus: 'missing',
  }]);
  const recordDetectionEvents = t.mock.fn(async ({ events }) => events.map((event, index) => ({
    ...event,
    id: `event-${index + 1}`,
  })));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createMetadataReleaseDetectionService({
    libraryWantedReleaseStore: {
      listWantedStatusesForReleaseGroups,
    },
    metadataReleaseDetectionStore: {
      listRecentEventsForArtist: t.mock.fn(async () => []),
      recordDetectionEvents,
    },
    recordAuditEventFn,
  });

  const events = await service.recordDetectedReleaseGroups({
    artistName: 'Autechre',
    metadataArtistId: 'local-artist-1',
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
    },
    operationRunId: 'run-1',
    refreshedAt: '2026-05-02T12:00:00.000Z',
    releaseGroups: [{
      firstReleaseDate: '2020-10-16',
      id: 'local-rg-2',
      primaryType: 'Album',
      source: { musicbrainzReleaseGroupId: 'mb-rg-2' },
      title: 'Sign',
    }, {
      firstReleaseDate: '2024-01-12',
      id: 'local-rg-3',
      primaryType: 'Single',
      source: { musicbrainzReleaseGroupId: 'mb-rg-3' },
      title: 'AE_2024',
    }],
    triggerSource: 'scheduled',
  });

  assert.deepEqual(listWantedStatusesForReleaseGroups.mock.calls[0].arguments[0], {
    metadataReleaseGroupIds: ['local-rg-2', 'local-rg-3'],
  });
  assert.equal(recordDetectionEvents.mock.callCount(), 1);
  assert.equal(events.length, 2);
  assert.equal(events[0].monitoringDecision, 'wanted_release_detected');
  assert.equal(events[0].resultingWantedStatus, 'missing');
  assert.equal(events[1].monitoringDecision, 'ignored_release_type');
  assert.equal(events[1].resultingWantedStatus, null);
  assert.equal(recordAuditEventFn.mock.callCount(), 2);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'metadata_release_group_detected');
});