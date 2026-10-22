import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners } from 'node:events';
import { PassThrough } from 'node:stream';
import { inspect } from 'node:util';
import { setImmediate as turn } from 'node:timers/promises';
import test from 'node:test';
import { createPublicDestinationResolver } from '../../src/server/network/public-destination-resolver.js';
import { createArtworkImageTransport } from '../../src/server/artwork/artwork-image-transport.js';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';

const public4 = '93.184.216.34'; const public6 = '2606:4700:4700::1111';
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const url = 'https://assets.fanart.tv/fanart/fixture.png';
const options = { sourceProvider: 'fanartTv' };
const secret = 'PRIVATE-egress-fixture';
function safe(kind) { return error => {
  assert.equal(error.diagnosticCode, kind); assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
  assert.equal(Object.hasOwn(error, 'cause'), false); return true;
}; }
function fakeRequest(records, response = () => ({ status: 200 })) {
  return (requested, input, callback) => {
    const outgoing = new EventEmitter();
    outgoing.destroy = () => { if (!outgoing.destroyed) { outgoing.destroyed = true; outgoing.emit('close'); } };
    outgoing.end = () => { queueMicrotask(() => {
      const spec = response(records.length);
      const incoming = new PassThrough();
      Object.assign(incoming, { statusCode: spec.status, headers: spec.headers ?? {}, complete: true });
      callback(incoming); incoming.end(png);
    }); };
    records.push({ requested, input }); return outgoing;
  };
}
const resolver = createResolverFn => createPublicDestinationResolver({ createResolverFn });

test('egress validates all address families before request admission, including mixed and disguised private answers', async () => {
  for (const [a, aaaa] of [[[public4, '127.0.0.1'], []], [[public4], ['::1']], [[public4], ['::ffff:8.8.8.8']],
    [[public4], ['64:ff9b::808:808']], [[public4], ['2001:db8::1']], [['169.254.169.254'], []], [[public6], []], [[], ['8.8.8.8']]]) {
    let cancelled = 0; const records = [];
    const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records), destinationResolver: resolver(() => ({
      resolve4: async () => a, resolve6: async () => aaaa, cancel() { cancelled++; },
    })) });
    await assert.rejects(transport.fetchImage(url, { signal: new AbortController().signal }), safe('destination_blocked'));
    assert.equal(records.length, 0); assert.equal(cancelled, 1);
  }
});

test('egress snapshot lookup pins both families and cannot be changed by resolver or lookup-result mutation', async () => {
  const answers = [{ address: public4, family: 4 }, { address: public6, family: 6 }];
  const records = []; let resolutions = 0;
  const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records), destinationResolver: {
    resolveDestinations: async () => { resolutions++; return answers; },
  } });
  const controller = new AbortController();
  const response = await transport.fetchImage(url, { signal: controller.signal, headers: { Host: secret, 'api-key': secret } });
  const input = records[0].input;
  assert.equal(input.servername, 'assets.fanart.tv'); assert.equal(input.headers.Host, 'assets.fanart.tv');
  assert.equal(input.headers['api-key'], undefined); assert.equal(input.autoSelectFamily, true); assert.equal(input.family, 0);
  assert.equal(input.rejectUnauthorized, true); assert.deepEqual(input.agent.options.proxyEnv, {});
  answers[0].address = '127.0.0.1';
  const lookup = hostname => { let result; input.lookup(hostname, { all: true }, (error, values) => { result = { error, values }; }); return result; };
  const first = lookup('assets.fanart.tv'); assert.equal(first.error, null);
  assert.deepEqual(first.values, [{ address: public4, family: 4 }, { address: public6, family: 6 }]);
  first.values[1].address = '::1';
  assert.equal(lookup('assets.fanart.tv').values[1].address, public6);
  assert.equal(lookup('different.invalid').error.diagnosticCode, 'destination_blocked');
  assert.equal(resolutions, 1);
  assert.deepEqual(Buffer.from(await new Response(response.body).arrayBuffer()), png);
  await turn(); assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('egress refuses injected invalid resolver snapshots before constructing an agent request', async () => {
  for (const answers of [[], null, Array(65).fill({ address: public4, family: 4 }),
    [{ address: public4, family: 6 }], [{ address: '127.0.0.1', family: 4 }], Array(1)]) {
    const records = [];
    const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records),
      destinationResolver: { resolveDestinations: async () => answers } });
    await assert.rejects(transport.fetchImage(url, { signal: new AbortController().signal }), safe('destination_blocked'));
    assert.equal(records.length, 0);
  }
});

test('configured proxies fail closed before DNS or request admission even with NO_PROXY wildcard', async () => {
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    let resolutions = 0; const records = [];
    const transport = createArtworkImageTransport({ env: { [key]: `http://user:${secret}@127.0.0.1:3128`, NO_PROXY: '*' },
      requestFn: fakeRequest(records), destinationResolver: { resolveDestinations: async () => { resolutions++; return []; } } });
    await assert.rejects(transport.fetchImage(url, { signal: new AbortController().signal }), safe('proxy_refused'));
    assert.equal(resolutions, 0); assert.equal(records.length, 0);
  }
});

test('default artwork and CAA composition uses protected egress rather than global fetch', async () => {
  const previousFetch = globalThis.fetch; const previousProxy = process.env.HTTPS_PROXY;
  globalThis.fetch = () => assert.fail('Global fetch must not own image connections');
  process.env.HTTPS_PROXY = `http://user:${secret}@127.0.0.1:3128`;
  try {
    await assert.rejects(createArtworkImageDownloadService().downloadImage(url, options), safe('proxy_refused'));
    await assert.rejects(createCoverArtArchiveClient({ maxRetries: 0 }).fetchFrontImage({ mbid: 'fixture' }), safe('proxy_refused'));
    const service = createArtworkFetchService({
      artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) }, listArtworkAssignmentsFn: async () => [],
      fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url }] },
      artworkIngestionService: { ingestArtworkBuffer: () => assert.fail('No ingestion after refusal') },
      artworkAssignmentService: { assignPreferredArtwork: () => assert.fail('No assignment after refusal') },
    });
    await assert.rejects(service.resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'fixture', artworkRole: 'artist_thumbnail' }), safe('proxy_refused'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousProxy === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = previousProxy;
  }
});

test('image deadline cancels both pending DNS queries and late answers cannot create a request', { timeout: 3000 }, async () => {
  let finish4; let finish6; let cancelled = 0; const records = [];
  const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records), destinationResolver: resolver(() => ({
    resolve4: () => new Promise(done => { finish4 = done; }), resolve6: () => new Promise(done => { finish6 = done; }), cancel() { cancelled++; },
  })) });
  const service = createArtworkImageDownloadService({ fetchImpl: transport.fetchImage, requestTimeoutMs: 30 });
  const keeper = setTimeout(() => {}, 2000);
  try { await assert.rejects(service.downloadImage(url, options), safe('timeout')); } finally { clearTimeout(keeper); }
  assert.equal(cancelled, 1); finish4([public4]); finish6([public6]); await turn(); assert.equal(records.length, 0);
});

test('fresh DNS is required after a CAA redirect and a rebound private target is never requested', async () => {
  const records = []; const dns = [];
  const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records, () => ({ status: 307,
    headers: { location: 'https://archive.org/download/fixture.png' } })), destinationResolver: resolver(() => ({
    resolve4: async hostname => { dns.push(hostname); return hostname === 'coverartarchive.org' ? [public4] : ['127.0.0.1']; },
    resolve6: async () => [], cancel() {},
  })) });
  const service = createArtworkImageDownloadService({ fetchImpl: transport.fetchImage });
  await assert.rejects(service.downloadImage('https://coverartarchive.org/release/fixture/front', { sourceProvider: 'coverArtArchive' }), safe('destination_blocked'));
  assert.deepEqual(dns, ['coverartarchive.org', 'archive.org']); assert.equal(records.length, 1);
});

test('CAA retry resolves afresh instead of reusing a prior public pin after DNS rebinding', async () => {
  const records = []; let channels = 0;
  const transport = createArtworkImageTransport({ env: {}, requestFn: fakeRequest(records, () => ({ status: 503 })),
    destinationResolver: resolver(() => {
      channels++; const address = channels === 1 ? public4 : '10.0.0.1';
      return { resolve4: async () => [address], resolve6: async () => [], cancel() {} };
    }) });
  const client = createCoverArtArchiveClient({ fetchImpl: transport.fetchImage, maxRetries: 1, sleepImpl: async () => {} });
  await assert.rejects(client.fetchFrontImage({ mbid: 'fixture' }), error => {
    safe('destination_blocked')(error); assert.equal(error.details.attempts, 2); return true;
  });
  assert.equal(channels, 2); assert.equal(records.length, 1);
});

test('extracted resolver returns a frozen bounded snapshot and does not cache DNS answers', async () => {
  let calls = 0;
  const destinations = resolver(() => ({ resolve4: async () => { calls++; return [public4]; }, resolve6: async () => [public6], cancel() {} }));
  const input = { hostname: 'assets.fanart.tv', signal: new AbortController().signal };
  const first = await destinations.resolveDestinations(input);
  assert.equal(Object.isFrozen(first), true); assert.ok(first.every(Object.isFrozen));
  assert.deepEqual(first, [{ address: public4, family: 4 }, { address: public6, family: 6 }]);
  await destinations.resolveDestinations(input); assert.equal(calls, 2);
});
