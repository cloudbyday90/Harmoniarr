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
    actionLabel: 'Set up Soulseek',
    actionRouteName: 'settings-connections',
    body: 'Choose Managed or connect an external Soulseek download client in Settings. Harmoniarr will not search, download, or check transfers while it is off.',
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
    body: 'When Harmoniarr queues a download, its progress will appear here.',
    title: 'Nothing downloading right now',
  });
});
