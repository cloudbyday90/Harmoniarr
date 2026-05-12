import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActivityFeedEntryLinkTarget } from '../../src/client/lib/activity-feed-link-targets.js';

test('activity feed link targets map operation entries onto existing run drill-through routes', () => {
  assert.deepEqual(buildActivityFeedEntryLinkTarget({
    entryType: 'operation',
    operationType: 'library_scan',
    runId: 'run-11',
  }), {
    label: 'View library scan',
    to: {
      hash: '#library-scan-panel',
      name: 'dashboard',
      query: {
        libraryScanRunId: 'run-11',
      },
    },
  });
});

test('activity feed link targets prefer metadata release-group drill-through when ids are present', () => {
  assert.deepEqual(buildActivityFeedEntryLinkTarget({
    entryType: 'audit',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
  }), {
    label: 'Open metadata release group',
    to: {
      name: 'metadata',
      query: {
        artistId: 'artist-1',
        releaseGroupId: 'release-group-1',
      },
    },
  });
});

test('activity feed link targets fall back to metadata artist and operation-event mappings', () => {
  assert.deepEqual(buildActivityFeedEntryLinkTarget({
    entryType: 'audit',
    metadataArtistId: 'artist-1',
  }), {
    label: 'Open metadata artist',
    to: {
      name: 'metadata',
      query: {
        artistId: 'artist-1',
      },
    },
  });

  assert.deepEqual(buildActivityFeedEntryLinkTarget({
    entryType: 'audit',
    entityId: 'run-44',
    eventType: 'import_candidate_execution_started',
  }), {
    label: 'View download run',
    to: {
      hash: '#import-execution-run-panel',
      name: 'review-queue',
      query: {
        executionRunId: 'run-44',
      },
    },
  });
});

test('activity feed link targets return null when no drill-through target exists', () => {
  assert.equal(buildActivityFeedEntryLinkTarget({ entryType: 'heartbeat' }), null);
  assert.equal(buildActivityFeedEntryLinkTarget({ entryType: 'audit' }), null);
});