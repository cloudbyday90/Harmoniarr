/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createArtworkEgressFixture } from './artwork-egress-fixture.js';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';

const scenario = process.argv[2]; let coverQueries = 0;
const fixture = createArtworkEgressFixture({ fallback: scenario === 'fallback', resolve4: async hostname => {
  if (scenario === 'blocked') return ['93.184.216.34', '127.0.0.1'];
  if (scenario === 'redirect-rebind' && hostname === 'archive.org') return ['127.0.0.1'];
  if (scenario === 'retry-rebind' && hostname === 'coverartarchive.org' && ++coverQueries > 1) return ['10.0.0.1'];
  return ['93.184.216.34'];
} });
const service = createArtworkImageDownloadService({ fetchImpl: fixture.fetchImpl });
const get = path => service.downloadImage(`https://assets.fanart.tv/${path}`, { sourceProvider: 'fanartTv' });
async function refused(operation, kind) {
  await assert.rejects(operation, error => {
    assert.equal(error.diagnosticCode, kind); assert.equal(inspect(error).includes('PRIVATE-egress'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false); return true;
  });
}
if (scenario === 'fallback') {
  assert.ok((await get('normal')).buffer.length > 0);
  assert.deepEqual(fixture.sockets.flatMap(socket => socket.autoSelectFamilyAttemptedAddresses ?? [])
    .map(address => address.slice(0, address.lastIndexOf(':'))), ['127.0.0.2', '127.0.0.1']);
  assert.equal(fixture.pins.length, 1); assert.equal(fixture.dns.length, 2);
} else if (scenario === 'blocked') {
  await refused(get('normal'), 'destination_blocked'); assert.equal(fixture.pins.length, 0);
} else if (scenario === 'proxy') {
  process.env.HTTPS_PROXY = process.env.HARMONIARR_TEST_PROXY_URL; process.env.NO_PROXY = '*';
  try { await refused(get('normal'), 'proxy_refused'); } finally { delete process.env.HTTPS_PROXY; delete process.env.NO_PROXY; }
  assert.equal(fixture.dns.length, 0); assert.equal(fixture.pins.length, 0);
} else if (scenario === 'tls-refusal') {
  await refused(get('normal'), 'transport_failed'); assert.equal(fixture.pins.length, 1);
} else if (['redirect-rebind', 'retry-rebind'].includes(scenario)) {
  const client = createCoverArtArchiveClient({ maxRetries: 1, fetchImpl: fixture.fetchImpl, sleepImpl: async () => {} });
  await refused(client.fetchFrontImage({ mbid: 'fixture' }), 'destination_blocked');
  assert.equal(fixture.pins.length, 1); assert.equal(fixture.dns.length, 4);
  assert.ok((await get('healthy')).buffer.length > 0);
} else throw new Error('Unknown egress fixture scenario');
console.log(JSON.stringify({ scenario, pinCount: fixture.pins.length, dnsQueries: fixture.dns.length,
  node: process.versions.node, passed: true, tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
