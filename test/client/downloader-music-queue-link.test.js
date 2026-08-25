import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderMusicQueueReleaseLinkLabel,
  buildDownloaderMusicQueueReleaseLocation,
  getDownloaderMusicQueueRelease,
} from '../../src/client/lib/downloader-music-queue-link.js';

const linkedTransfer = Object.freeze({
  diagnostics: {
    importLinkage: {
      musicQueueRelease: {
        artistName: 'Autechre',
        releaseTitle: 'Amber',
        wantedReleaseId: 'wanted-release-1',
        wantedStatus: 'missing',
      },
    },
  },
});

test('Downloader Music Queue handoff resolves a durable release destination and descriptive label', () => {
  assert.deepEqual(getDownloaderMusicQueueRelease(linkedTransfer), {
    artistName: 'Autechre',
    releaseTitle: 'Amber',
    wantedReleaseId: 'wanted-release-1',
    wantedStatus: 'missing',
  });
  assert.deepEqual(buildDownloaderMusicQueueReleaseLocation(linkedTransfer), {
    name: 'music-queue-release',
    params: { wantedReleaseId: 'wanted-release-1' },
  });
  assert.equal(
    buildDownloaderMusicQueueReleaseLinkLabel(linkedTransfer),
    'Open Music Queue release: Autechre — Amber',
  );
});

test('Downloader Music Queue handoff is unavailable without a durable wanted-release ID', () => {
  assert.equal(getDownloaderMusicQueueRelease({ diagnostics: { importLinkage: {} } }), null);
  assert.equal(buildDownloaderMusicQueueReleaseLocation({ diagnostics: { importLinkage: {} } }), null);
});
