/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';
import { albumId, otherAlbumId, cover } from '../../testing/server/fanart-wiring-fixture.js';

test('native composed Fanart.tv credentials rotate and clear while compressed albums retain target ownership', { timeout: 20000 }, async t => {
  let calls = 0;
  const keys = [['fixture-saved-project', 'fixture-saved-personal'], ['fixture-rotated-project', 'fixture-rotated-personal'],
    ['fixture-env-project', 'fixture-env-personal'], ['fixture-env-project', 'fixture-env-personal']];
  await withProviderHttpsFixture({ signal: t.signal, consumerUrl: new URL('../../testing/server/fanart-wiring-https-consumer.js', import.meta.url),
    handler(req, res) {
      const expected = keys[calls++]; assert.ok(expected);
      assert.equal(req.headers.host, 'webservice.fanart.tv'); assert.equal(req.socket.servername, 'webservice.fanart.tv');
      assert.equal(req.method, 'GET'); assert.equal(req.url, `/v3.2/music/albums/${albumId}`);
      assert.deepEqual([req.headers['api-key'], req.headers['client-key']], expected);
      const albums = [{ release_group_id: otherAlbumId, albumcover: [{ ...cover, url: 'https://assets.fanart.tv/foreign.jpg', likes: '999' }] }];
      if (calls !== 4) albums.push({ release_group_id: albumId, albumcover: [cover] });
      const bytes = gzipSync(JSON.stringify({ name: 'Fixture artist', mbid_id: otherAlbumId, albums }));
      res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': String(bytes.length) });
      res.end(bytes);
    },
  }, async ({ records, runClient }) => {
    const result = await runClient('wiring');
    assert.equal(result.composedCredentials, true); assert.equal(result.rotationAndClear, true);
    assert.equal(result.targetOwnedAssignments, 3); assert.equal(result.mismatchAndCredentialFailureRefused, true);
    assert.equal(result.node, process.versions.node); assert.equal(result.tlsVerificationDisabled, false);
    assert.equal(calls, 4); assert.equal(records.requests.length, 4);
    assert.ok(records.tunnels.every(authority => authority === 'webservice.fanart.tv:443'));
    assert.equal(records.tlsErrors.length, 0);
  });
});
