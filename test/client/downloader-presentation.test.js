import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderActivitySummary,
  buildDownloaderEmptyState,
  isDownloaderProviderDisabled,
} from '../../src/client/lib/downloader-presentation.js';

test('downloader presentation reports disabled provider setup guidance', () => {
  const queue = {
    providerState: {
      enabled: false,
      message: 'Configure Soulseek (slskd) in Settings to enable downloads.',
    },
    queueHealth: {
      status: 'disabled',
    },
  };

  assert.equal(isDownloaderProviderDisabled(queue), true);
  assert.equal(
    buildDownloaderActivitySummary(queue),
    'Configure Soulseek (slskd) in Settings to enable downloads.',
  );
  assert.deepEqual(buildDownloaderEmptyState(queue), {
    actionLabel: 'Configure slskd',
    actionRouteName: 'settings-connections',
    body: 'Add your Soulseek download client URL and slskd API key in Settings. Once connected, downloads queued from Search or Import Review will appear here.',
    title: 'Set up Soulseek to enable downloads',
  });
});

test('downloader presentation reports friendly idle state for configured providers', () => {
  const queue = {
    providerState: {
      enabled: true,
    },
    queueHealth: {
      message: 'No active downloads right now.',
      status: 'idle',
    },
  };

  assert.equal(isDownloaderProviderDisabled(queue), false);
  assert.equal(buildDownloaderActivitySummary(queue), 'No active downloads right now.');
  assert.deepEqual(buildDownloaderEmptyState(queue), {
    actionLabel: null,
    actionRouteName: null,
    body: 'When Harmoniarr queues a download from Search or Import Review, progress will appear here.',
    title: 'Nothing downloading right now',
  });
});
