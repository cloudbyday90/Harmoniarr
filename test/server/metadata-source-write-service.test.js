/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataSourceWriteService } from '../../src/server/metadata/metadata-source-write-service.js';
import { createOperatorArtistSaveStateStore } from '../../src/server/metadata/operator-artist-save-state-store.js';
import { createMetadataService } from '../../src/server/metadata/metadata-service.js';
import { forceCanonicalRelease } from '../../src/server/metadata/canonical-release-service.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';

function fixture(fails = {}) {
  const calls = []; const releases = []; let checkouts = 0;
  const client = { query: async (sql, params) => { calls.push({ sql, params }); if (Object.hasOwn(fails, sql)) throw fails[sql];
    return { rows: sql.includes('SELECT metadata_release_group_id') ? [{ metadata_release_group_id: 'group' }] : [{ id: 'stored' }] }; }, release: value => releases.push(value) };
  const writes = createMetadataSourceWriteService({ getPoolFn: () => ({ connect: async () => { checkouts++; return client; } }) });
  return { writes, client, calls, releases, get checkouts() { return checkouts; } };
}

for (const mode of ['policy', 'catalog']) {
  test(`${mode} writes own one transaction and acquire admission before work`, async () => {
    const f = fixture(); const work = async client => { assert.equal(client, f.client); await client.query('WRITE'); return 'result'; };
    const result = await (mode === 'policy' ? f.writes.withPolicyWrite({ appUserId: 'actor', metadataArtistId: 'artist' }, work) : f.writes.withExclusiveWrite(work));
    assert.equal(result, 'result'); assert.equal(f.checkouts, 1); assert.equal(f.releases.length, 1); assert.equal(f.calls[0].sql, 'BEGIN'); assert.equal(f.calls.at(-1).sql, 'COMMIT');
    const admission = f.calls.findIndex(call => call.params?.[0] === 'harmoniarr.metadata-source-admission');
    assert.ok(admission > 0); assert.ok(admission < f.calls.findIndex(call => call.sql === 'WRITE'));
    assert.equal(f.calls[admission].sql.includes('_shared('), mode === 'policy');
    if (mode === 'policy') assert.ok(admission < f.calls.findIndex(call => call.params?.[0] === 'operator_artist_save'));
  });
  test(`${mode} borrowed writes leave transaction and client ownership with caller`, async () => {
    const f = fixture(); const writes = createMetadataSourceWriteService({ getPoolFn: () => assert.fail('borrowed work must not checkout') });
    const work = async client => { assert.equal(client, f.client); return 'borrowed'; };
    const result = await (mode === 'policy' ? writes.withPolicyWrite({ appUserId: 'actor', metadataArtistId: 'artist', queryable: f.client }, work)
      : writes.withExclusiveWrite(work, { queryable: f.client }));
    assert.equal(result, 'borrowed'); assert.equal(f.releases.length, 0); assert.equal(f.calls.some(call => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(call.sql)), false);
  });
}
test('autocommit refusal occurs before admission or mutation', async () => {
  const error = Object.assign(new Error('transaction required'), { code: '25P01' }); const f = fixture({ 'LOCK TABLE metadata_artists IN ROW EXCLUSIVE MODE': error });
  await assert.rejects(f.writes.withExclusiveWrite(async () => assert.fail('refused client must not write'), { queryable: f.client }), thrown => thrown === error);
  assert.equal(f.calls.length, 1); assert.equal(f.releases.length, 0);
});
for (const primary of [new Error('write'), null]) {
  test(`owned source ${primary === null ? 'null' : 'Error'} survives rollback fallout and evicts uncertain client`, async () => {
    const f = fixture({ ROLLBACK: null });
    await assert.rejects(f.writes.withExclusiveWrite(async () => { throw primary; }), error => error === primary);
    assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert.ok(f.releases[0] instanceof Error); assert.equal(f.releases[0].cause, null);
  });
}
test('scope admission precedes scope locking for save/queue/recovery callers', async () => {
  const f = fixture(); await createOperatorArtistSaveStateStore().lockOperatorArtistSave({ appUserId: 'actor', metadataArtistId: 'artist', client: f.client });
  assert.equal(f.calls[0].params[0], 'harmoniarr.metadata-source-admission'); assert.equal(f.calls[1].params[0], 'operator_artist_save');
});
test('metadata graph and direct upserts share the existing client without nested BEGIN', async () => {
  const f = fixture(); await createMetadataService({ pool: { connect: async () => f.client } }).storeReleaseGraph({ artist: { sourceProvider: 'musicbrainz', sourceArtistId: 'artist', name: 'Artist' },
    releaseGroup: { sourceProvider: 'musicbrainz', sourceReleaseGroupId: 'group', title: 'Group' }, release: { sourceProvider: 'musicbrainz', sourceReleaseId: 'release', title: 'Release' } });
  assert.equal(f.calls.filter(call => call.sql === 'BEGIN').length, 1); assert.equal(f.calls.filter(call => call.sql === 'COMMIT').length, 1);
  assert.equal(f.releases.length, 1); assert.equal(f.calls.find(call => call.params?.[0] === 'harmoniarr.metadata-source-admission').sql.includes('_shared('), false);
});
test('canonical setting failure rolls back clearing and releases the admitted transaction', async () => {
  const error = new Error('set canonical'); const sql = 'UPDATE metadata_releases SET is_canonical = TRUE WHERE id = $1'; const f = fixture({ [sql]: error });
  await assert.rejects(forceCanonicalRelease('release', { getPoolFn: () => ({ connect: async () => f.client }) }), thrown => thrown === error);
  assert.equal(f.calls.some(call => call.sql.includes('SET is_canonical = FALSE')), true); assert.equal(f.calls.at(-1).sql, 'ROLLBACK'); assert.equal(f.releases.length, 1);
});

for (const owner of ['artist', 'monitoring']) {
  test(`${owner} captures accepted mutable input before admission waits`, async () => {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const f = fixture();
    const query = f.client.query; f.client.query = async (...args) => {
      if (args[1]?.[0] === 'harmoniarr.metadata-source-admission') { entered.resolve(); await gate.promise; }
      return query(...args);
    };
    const artist = { sourceProvider: 'musicbrainz', sourceArtistId: 'artist', name: 'Accepted artist', rawPayload: { consent: null } };
    const types = ['album']; const pool = { connect: async () => f.client };
    const pending = owner === 'artist' ? createMetadataService({ pool }).storeArtist({ artist })
      : createOperatorArtistMonitoringStore({ getPoolFn: () => pool }).upsertOperatorArtistMonitoring({ appUserId: 'actor', metadataArtistId: 'artist', isMonitored: true, monitoredReleaseGroupTypes: types });
    await entered.promise;
    try { artist.name = 'Changed artist'; artist.rawPayload.consent = {}; types.push('ep'); }
    finally { gate.resolve(); await pending; }
    const write = f.calls.find(call => call.sql.includes(owner === 'artist' ? 'INSERT INTO metadata_artists' : 'INSERT INTO operator_artist_monitoring'));
    if (owner === 'artist') { assert.equal(write.params[3], 'Accepted artist'); assert.equal(write.params[10], '{"consent":null}'); }
    else assert.deepEqual(write.params[3], ['album']);
  });
}
