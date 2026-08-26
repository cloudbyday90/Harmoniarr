import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDownloaderTransferFilterResultLabel,
  filterDownloaderTransfers,
  isDownloaderTransferLinkedToMusicQueue,
} from '../../src/client/lib/downloader-transfer-filter.js';

const linkedTransfer = Object.freeze({
  diagnostics: Object.freeze({
    importLinkage: Object.freeze({
      musicQueueRelease: Object.freeze({
        wantedReleaseId: 'wanted-release-linked',
      }),
    }),
  }),
  id: 'linked',
  state: Object.freeze({ code: 'active' }),
});

const unlinkedTransfer = Object.freeze({
  diagnostics: Object.freeze({
    importLinkage: Object.freeze({
      musicQueueRelease: Object.freeze({ releaseTitle: 'No durable identifier' }),
    }),
  }),
  id: 'unlinked',
  state: Object.freeze({ code: 'queued' }),
});

test('filters Downloader transfers by the independent state and release-linkage conditions', () => {
  const transfers = [linkedTransfer, unlinkedTransfer];

  assert.deepEqual(filterDownloaderTransfers(transfers), transfers);
  assert.deepEqual(filterDownloaderTransfers(transfers, { stateFilter: 'active' }), [linkedTransfer]);
  assert.deepEqual(filterDownloaderTransfers(transfers, { musicQueueLinkedOnly: true }), [linkedTransfer]);
  assert.deepEqual(filterDownloaderTransfers(transfers, {
    musicQueueLinkedOnly: true,
    stateFilter: 'queued',
  }), []);
  assert.deepEqual(filterDownloaderTransfers(transfers, {
    wantedReleaseId: 'wanted-release-linked',
  }), [linkedTransfer]);
  assert.deepEqual(filterDownloaderTransfers(transfers, {
    stateFilter: 'active',
    wantedReleaseId: 'wanted-release-missing',
  }), []);
});

test('treats only a durable wanted release identifier as a release linkage', () => {
  assert.equal(isDownloaderTransferLinkedToMusicQueue(linkedTransfer), true);
  assert.equal(isDownloaderTransferLinkedToMusicQueue(unlinkedTransfer), false);
  assert.equal(isDownloaderTransferLinkedToMusicQueue(null), false);
});

test('falls back to all states and produces an accurate result label', () => {
  assert.deepEqual(filterDownloaderTransfers([linkedTransfer], { stateFilter: 'unknown' }), [linkedTransfer]);
  assert.equal(buildDownloaderTransferFilterResultLabel(1, 1), 'Showing 1 of 1 transfer.');
  assert.equal(buildDownloaderTransferFilterResultLabel(0, 2), 'Showing 0 of 2 transfers.');
  assert.equal(buildDownloaderTransferFilterResultLabel(-1, Number.NaN), 'Showing 0 of 0 transfers.');
  assert.equal(
    buildDownloaderTransferFilterResultLabel(1, 2, { wantedReleaseId: 'wanted-release-linked' }),
    'Showing 1 transfer linked to this Missing Music release.',
  );
});
