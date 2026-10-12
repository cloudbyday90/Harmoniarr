/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistMonitoringService } from '../../src/server/metadata/operator-artist-monitoring-service.js';
import { createOperatorArtistReconciliationSnapshotService } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-service.js';
import { createMetadataReadService } from '../../src/server/metadata/metadata-read-service.js';

for (const primary of [new Error('nested read'), null]) {
  for (const owner of ['monitoring', 'snapshot', 'artist']) {
    test(`${owner} read drains returned siblings after ${primary === null ? 'null' : 'Error'}`, async () => {
      const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let settled = false;
      const pool = { query: async sql => {
        if (owner === 'artist' && /FROM metadata_artists/u.test(sql)) return { rows: [{ id: 'artist', name: 'Artist' }] };
        if (/FROM app_users|metadata_artist_aliases/u.test(sql)) throw primary;
        entered.resolve(); await gate.promise; return { rows: [{ id: 'artist' }] };
      } };
      let pending;
      if (owner === 'artist') {
        pending = createMetadataReadService({ pool,
          metadataReleaseDetectionService: { listDetectionEventsPageForArtist: async () => { entered.resolve(); await gate.promise; return { entries: [], pageInfo: {} }; } },
          metadataMonitoredArtistStore: { getArtistMonitoringStatus: async () => null },
        }).getArtist({ artistId: 'artist' });
      } else if (owner === 'snapshot') {
        pending = createOperatorArtistReconciliationSnapshotService({ getPoolFn: () => pool,
          operatorArtistReconciliationSnapshotStore: { getOperatorArtistReconciliationSnapshotById: async () => assert.fail('failed identity read must not lookup snapshot') },
        }).getOperatorArtistReconciliationSnapshotById({ appUserId: 'operator', metadataArtistId: 'artist', snapshotId: 'snapshot' });
      } else {
        pending = createOperatorArtistMonitoringService({ getPoolFn: () => pool,
          operatorArtistMonitoringStore: { getOperatorArtistMonitoring: async () => assert.fail('failed identity read must not lookup monitoring') },
        }).getOperatorArtistMonitoring({ appUserId: 'operator', metadataArtistId: 'artist' });
      }
      void pending.then(() => { settled = true; }, () => { settled = true; }); await entered.promise;
      try { await new Promise(resolve => { setImmediate(resolve); }); assert.equal(settled, false); }
      finally { gate.resolve(); await pending.catch(() => {}); }
      await assert.rejects(pending, error => error === primary);
    });
  }
}
