import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMissingMusicDownloaderHandoffRouteQuery,
  omitMissingMusicDownloaderHandoffRouteQuery,
} from '../../src/client/lib/missing-music-downloader-handoff-route.js';

test('Missing Music Downloader handoff URL retains only an opaque decision identifier', () => {
  assert.deepEqual(
    normalizeMissingMusicDownloaderHandoffRouteQuery({
      missingMusicDecisionId: [' wanted-amber ', 'ignored'],
      providerTransferId: 'must-not-be-read',
      requestedForUserId: 'must-not-be-read',
    }),
    { decisionId: 'wanted-amber' },
  );
  assert.deepEqual(
    normalizeMissingMusicDownloaderHandoffRouteQuery({ missingMusicDecisionId: ' ' }),
    { decisionId: '' },
  );
});

test('clearing a Missing Music Downloader handoff preserves unrelated URL state', () => {
  assert.deepEqual(
    omitMissingMusicDownloaderHandoffRouteQuery({
      missingMusicDecisionId: 'wanted-amber',
      open: 'details',
      transferKey: 'local-transfer-key',
    }),
    { open: 'details', transferKey: 'local-transfer-key' },
  );
});
