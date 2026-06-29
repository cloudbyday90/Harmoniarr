import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMusicQueueQualityBlockedActivityEvent } from '../../src/server/activity/music-queue-quality-activity-presentation-service.js';

test('buildMusicQueueQualityBlockedActivityEvent emits a Music Queue deep link payload', () => {
  const event = buildMusicQueueQualityBlockedActivityEvent({
    qualityGate: {
      blockers: [{
        code: 'safe_auto_spectral_transcoded',
        fileId: 'file-1',
        filename: '01 Fake.flac',
        message: 'Spectral analysis does not verify this lossless file.',
      }],
      checkedFileCount: 12,
      message: '1 file did not pass verified lossless checks before automatic add.',
      profileCode: 'lossless_archive',
      status: 'blocked',
    },
    runId: 'run-1',
    summaryCandidate: {
      folderPath: '/downloads/Artist/Album',
      id: 'candidate-1',
      musicQueueContext: {
        wantedReleaseId: 'wanted-1',
      },
      releaseIdentity: {
        artistName: 'Artist',
        releaseTitle: 'Album',
      },
    },
  });

  assert.equal(event.eventType, 'music_queue_quality_blocked');
  assert.equal(event.entityType, 'wanted_release');
  assert.equal(event.entityId, 'wanted-1');
  assert.equal(event.entityTitle, 'Album');
  assert.equal(event.entityArtist, 'Artist');
  assert.equal(event.extraPayload.importCandidateId, 'candidate-1');
  assert.equal(event.extraPayload.blockers[0].filename, '01 Fake.flac');
  assert.deepEqual(event.extraPayload.route, {
    name: 'music-queue-release',
    params: { wantedReleaseId: 'wanted-1' },
  });
});
