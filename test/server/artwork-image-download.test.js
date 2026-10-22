import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { setImmediate as turn } from 'node:timers/promises';
import test from 'node:test';
import sharp from 'sharp';
import { createArtworkImageDownloadService } from '../../src/server/artwork/artwork-image-download-service.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';
import { inspectArtworkBuffer, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';

const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
const url = 'https://assets.fanart.tv/fanart/fixture.png';
const secret = 'PRIVATE-fixture-image';
const options = { sourceProvider: 'fanartTv' };
const download = (fetchImpl, extra = {}) => createArtworkImageDownloadService({ fetchImpl, ...extra }).downloadImage;
function safe(kind) {
  return error => {
    assert.equal(error.code, 'artwork_image_unavailable'); assert.equal(error.diagnosticCode, kind);
    assert.equal(inspect(error, { depth: 9 }).includes(secret), false);
    assert.equal(Object.hasOwn(error, 'cause'), false); return true;
  };
}

test('artwork image URL policy refuses unapproved scheme, authority, port and credential carriers before dispatch', async t => {
  const fetchImpl = t.mock.fn(); const get = download(fetchImpl);
  for (const value of ['http://assets.fanart.tv/a', 'https://assets.fanart.tv:444/a', `https://u:${secret}@assets.fanart.tv/a`,
    `https://assets.fanart.tv/a?key=${secret}`, `https://assets.fanart.tv/a#${secret}`, `https://assets.fanart.tv.${secret}.invalid/a`,
    'https://127.0.0.1/a', 'https://[::1]/a', 'https://2130706433/a', 'https://169.254.169.254/a', 'https://localhost/a',
    'file:///etc/passwd', null, '', secret]) await assert.rejects(get(value, options), safe('url_refused'));
  await assert.rejects(get(url, { sourceProvider: 'theAudioDb' }), safe('url_refused'));
  await assert.rejects(get(url, { sourceProvider: 'unknown' }), safe('url_refused'));
  for (const maxOriginalFileSizeBytes of [0, -1, 1.5, 104857601]) {
    await assert.rejects(get(url, { ...options, limits: { maxOriginalFileSizeBytes } }), safe('policy_invalid'));
  }
  assert.equal(fetchImpl.mock.callCount(), 0);
});

test('artwork images preserve PNG JPEG WebP bytes and derive MIME from signatures rather than provider headers', async () => {
  for (const format of ['png', 'jpeg', 'webp']) {
    const image = await sharp(png)[format]().toBuffer();
    const result = await download(async (_url, request) => {
      assert.equal(request.redirect, 'manual'); assert.equal(request.credentials, 'omit');
      assert.equal(request.headers['Accept-Encoding'], 'identity');
      assert.equal(Object.hasOwn(request.headers, 'api-key'), false);
      return new Response(image, { headers: { 'content-type': 'text/html' } });
    })(url, options);
    assert.deepEqual(result.buffer, image); assert.equal(result.contentType, `image/${format}`); assert.equal(result.sourceUrl, url);
  }
});

test('Cover Art Archive redirects retire bodies before the next hop and upgrade approved legacy links without plaintext', async () => {
  let release; let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const get = download(async (requested, request) => {
    calls++; assert.equal(requested.protocol, 'https:');
    if (calls === 1) return new Response(new ReadableStream({ cancel: () => gate }), { status: 307, headers: { location: 'http://archive.org/download/fixture.png' } });
    assert.equal(requested.href, 'https://archive.org/download/fixture.png'); return new Response(png);
  });
  const pending = get('https://coverartarchive.org/release/fixture/front', { sourceProvider: 'coverArtArchive' });
  await turn(); assert.equal(calls, 1); release(); assert.deepEqual((await pending).buffer, png); assert.equal(calls, 2);
});

test('redirect refusal never dispatches forbidden targets and CAA loops are bounded', async t => {
  for (const [sourceProvider, initial] of [['fanartTv', url], ['theAudioDb', 'https://www.theaudiodb.com/images/a.png']]) {
    const fetchImpl = t.mock.fn(async () => new Response(null, { status: 302, headers: { location: 'https://archive.org/image.png' } }));
    await assert.rejects(download(fetchImpl)(initial, { sourceProvider }), safe('redirect_refused')); assert.equal(fetchImpl.mock.callCount(), 1);
  }
  for (const location of [null, `https://${secret}.invalid/a`, 'https://archive.org.evil.invalid/a', 'http://127.0.0.1/a']) {
    const fetchImpl = t.mock.fn(async () => new Response(null, { status: 307, headers: location ? { location } : {} }));
    await assert.rejects(download(fetchImpl)('https://coverartarchive.org/front', { sourceProvider: 'coverArtArchive' }), safe('url_refused'));
    assert.equal(fetchImpl.mock.callCount(), 1);
  }
  const loop = t.mock.fn(async () => new Response(null, { status: 307, headers: { location: '/loop' } }));
  await assert.rejects(download(loop)('https://coverartarchive.org/front', { sourceProvider: 'coverArtArchive' }), safe('redirect_refused'));
  assert.equal(loop.mock.callCount(), 4);
});

test('image body limits accept the exact ceiling and await retirement on the first excess byte', async () => {
  const limits = { maxOriginalFileSizeBytes: png.length };
  assert.deepEqual((await download(async () => new Response(png))(url, { ...options, limits })).buffer, png);
  let cancelled = false; let release; let done = false;
  const gate = new Promise(resolve => { release = resolve; });
  const body = new ReadableStream({ start(controller) { controller.enqueue(png); controller.enqueue(Buffer.from([0])); }, cancel: () => gate.then(() => { cancelled = true; }) });
  const pending = assert.rejects(download(async () => new Response(body))(url, { ...options, limits }), safe('body_too_large')).then(() => { done = true; });
  await turn(); assert.equal(done, false); release(); await pending; assert.equal(cancelled, true);
});

test('a failed redirect-body cancellation refuses before another request rather than treating cleanup failure as retirement', async t => {
  const fetchImpl = t.mock.fn(async () => new Response(new ReadableStream({ cancel() { throw new Error(secret); } }),
    { status: 307, headers: { location: 'https://archive.org/download/fixture.png' } }));
  await assert.rejects(download(fetchImpl)('https://coverartarchive.org/front', { sourceProvider: 'coverArtArchive' }), safe('response_invalid'));
  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('oversized declarations, compressed HTTP images and non-raster payloads refuse with private diagnostics', async () => {
  for (const headers of [{ 'content-length': '104857601' }, { 'content-length': 'invalid' }]) {
    await assert.rejects(download(async () => new Response(png, { headers }))(url, options), safe('body_too_large'));
  }
  for (const encoding of ['gzip', 'br', 'deflate']) {
    await assert.rejects(download(async () => new Response(png, { headers: { 'content-encoding': encoding } }))(url, options), safe('encoding_refused'));
  }
  for (const body of ['', `<svg><text>${secret}</text></svg>`, `<html>${secret}</html>`]) {
    await assert.rejects(download(async () => new Response(body))(url, options), safe('format_refused'));
  }
});

test('image error bodies retire before absence publication and known HTTP classification survives cleanup errors', async () => {
  let release; let finished = false;
  const gate = new Promise(resolve => { release = resolve; });
  const absent = download(async () => new Response(new ReadableStream({ cancel: () => gate }), { status: 404 }))(url, options)
    .then(result => { finished = true; assert.equal(result, null); });
  await turn(); assert.equal(finished, false); release(); await absent;
  for (const status of [400, 404, 401, 429, 503]) {
    const get = download(async () => new Response(new ReadableStream({ cancel() { throw new Error(secret); } }), { status }));
    if (status === 404) assert.equal(await get(url, options), null);
    else await assert.rejects(get(url, options), error => { safe('http_rejected')(error); assert.equal(error.details.status, status); return true; });
  }
});

test('a body error cannot impersonate an approved image error and retain provider data', async () => {
  const forged = Object.assign(new Error(secret), { code: 'artwork_image_unavailable', diagnosticCode: secret });
  await assert.rejects(download(async () => new Response(new ReadableStream({ start(controller) { controller.error(forged); } })))(url, options), safe('response_invalid'));
});

test('image deadline owns stalled headers and active reads without admitting a second hop', { timeout: 3000 }, async () => {
  const keeper = setTimeout(() => {}, 2500);
  try {
    for (const phase of ['headers', 'body']) {
      let signal; let retired = false;
      const get = download(async (_url, request) => {
        signal = request.signal;
        return phase === 'headers' ? new Promise(() => {}) : new Response(new ReadableStream({ cancel() { retired = true; } }));
      }, { requestTimeoutMs: 30 });
      await assert.rejects(get(url, options), safe('timeout')); assert.equal(signal.aborted, true);
      if (phase === 'body') assert.equal(retired, true);
    }
  } finally { clearTimeout(keeper); }
});

test('Cover Art Archive retires failed responses before retry and defers unrepresentable Retry-After', async t => {
  let calls = 0; let retired = false;
  const client = createCoverArtArchiveClient({ maxRetries: 1, sleepImpl: async delay => { assert.equal(retired, true); assert.equal(delay, 3000); },
    fetchImpl: async () => ++calls === 1 ? new Response(new ReadableStream({ cancel() { retired = true; } }), { status: 503, headers: { 'retry-after': '3' } }) : new Response(png) });
  assert.deepEqual((await client.fetchFrontImage({ mbid: 'fixture' })).buffer, png); assert.equal(calls, 2);
  const fetchImpl = t.mock.fn(async () => new Response(secret, { status: 429, headers: { 'retry-after': '2147484' } }));
  await assert.rejects(createCoverArtArchiveClient({ fetchImpl, sleepImpl: async () => assert.fail('Must defer') }).fetchFrontImage({ mbid: 'fixture' }), error => {
    assert.equal(error.diagnosticCode, 'retry_deferred'); assert.equal(inspect(error).includes(secret), false); return true;
  });
  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('actual artwork consumer refuses a provider URL before download admission and publishes no assignment', async t => {
  const ingestArtworkBuffer = t.mock.fn(); const assignPreferredArtwork = t.mock.fn();
  const service = createArtworkFetchService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) },
    listArtworkAssignmentsFn: async () => [], artworkIngestionService: { ingestArtworkBuffer }, artworkAssignmentService: { assignPreferredArtwork },
    fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'http://169.254.169.254/metadata' }] } });
  await assert.rejects(service.resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: 'fixture', artworkRole: 'artist_thumbnail' }), safe('url_refused'));
  assert.equal(ingestArtworkBuffer.mock.callCount(), 0); assert.equal(assignPreferredArtwork.mock.callCount(), 0);
});

test('real Sharp refuses SVG and excessive input pixels before sanitized asset preparation', async () => {
  await assert.rejects(inspectArtworkBuffer(Buffer.from(`<svg>${secret}</svg>`)), { code: 'artwork_format_unsupported' });
  const policy = { limits: { maxOriginalFileSizeBytes: 1024 * 1024, maxOriginalDimensionPixels: 8 }, storage: { root: '/fixture' } };
  await assert.rejects(prepareArtworkAsset({ buffer: png, policy }), { code: 'artwork_image_invalid' });
  await assert.rejects(inspectArtworkBuffer(Buffer.from([0xff, 0xd8, 0xff])), { code: 'artwork_image_invalid' });
  const frames = Buffer.concat([Buffer.alloc(16 * 16 * 3, 0), Buffer.alloc(16 * 16 * 3, 255)]);
  const animated = await sharp(frames, { raw: { width: 16, height: 32, channels: 3, pageHeight: 16 } })
    .webp({ loop: 0, delay: [100, 100] }).toBuffer();
  await assert.rejects(prepareArtworkAsset({ buffer: animated,
    policy: { ...policy, limits: { ...policy.limits, maxOriginalDimensionPixels: 32 } } }), { code: 'artwork_animation_unsupported' });
});
