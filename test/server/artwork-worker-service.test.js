import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { createArtworkIngestionService, prepareArtworkAsset } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';

const input = { buffer: Buffer.from('input'), maxBytes: 20, maxDimensionPixels: 8 };
const output = () => Buffer.from(`${JSON.stringify({ size: 3, width: 8, height: 8, format: 'png', dominant: null })}\nabc`);
function fixture(options = {}) {
  const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough();
  const killed = Promise.withResolvers(); const kills = []; let spawnOptions; let spawnArgs;
  child.kill = signal => { kills.push(signal); killed.resolve(); if (options.killThrows) throw new Error('private'); return true; };
  const service = createArtworkWorkerService({ ...options, spawnFn: (...args) => { spawnArgs = args; spawnOptions = args[2]; return child; } });
  return { child, service, killed: killed.promise, kills, getSpawn: () => ({ spawnOptions, spawnArgs }) };
}

test('worker spawn uses an explicit ESM module, bounded scalar arguments and a minimal environment', async () => {
  const f = fixture(); const pending = f.service.processArtworkBuffer(input);
  const { spawnArgs, spawnOptions } = f.getSpawn();
  assert.equal(spawnArgs[0], process.execPath); assert.match(spawnArgs[1][0], /artwork-image-worker\.js$/u);
  assert.deepEqual(spawnArgs[1].slice(1), ['20', '8']);
  assert.equal(spawnOptions.shell, false); assert.equal(spawnOptions.windowsHide, true);
  assert.deepEqual(spawnOptions.stdio, ['pipe', 'pipe', 'ignore']);
  assert.deepEqual(Object.keys(spawnOptions.env).sort(), [...(process.env.SystemRoot ? ['SystemRoot'] : []), 'UV_THREADPOOL_SIZE', 'VIPS_CONCURRENCY', 'NODE_ENV'].sort());
  f.child.stdout.write(output()); f.child.emit('exit', 0, null);
  let settled = false; void pending.then(() => { settled = true; }); await Promise.resolve(); assert.equal(settled, false);
  f.child.emit('close', 0, null); assert.equal((await pending).data.toString(), 'abc');
});

test('worker deadline kills once and retains ownership through late output and exit until actual close', async () => {
  const f = fixture({ timeoutMs: 5 }); const pending = f.service.processArtworkBuffer(input);
  const rejected = assert.rejects(pending, { code: 'artwork_worker_timeout', status: 503 });
  await f.killed; let settled = false; void pending.catch(() => { settled = true; });
  f.child.stdout.write(output()); f.child.emit('exit', 0, null); await Promise.resolve(); assert.equal(settled, false);
  assert.deepEqual(f.kills, ['SIGKILL']); f.child.emit('close', 0, null); await rejected;
});

test('active cancellation fences publication and holds the shared ingestion slot until worker close', async () => {
  const f = fixture({ killThrows: true }); const gate = createArtworkIngestionAdmission({ concurrency: 1 });
  const controller = new AbortController(); let publications = 0; let dispatches = 0;
  const service = createArtworkIngestionService({ artworkIngestionAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ limits: { maxOriginalDimensionPixels: 8 }, storage: { root: '/owned' } }) },
    prepareArtworkAssetFn: options => { dispatches++; return prepareArtworkAsset({ ...options, transformArtworkBufferFn: f.service.processArtworkBuffer }); },
    getArtworkAssetBySha256Fn: async () => { publications++; return null; }, mkdirFn: async () => { publications++; },
    writeFileFn: async () => { publications++; }, upsertArtworkAssetFn: async () => { publications++; },
  });
  const started = service.ingestArtworkBuffer({ buffer: input.buffer, signal: controller.signal });
  const rejection = assert.rejects(started, { code: 'artwork_worker_cancelled' });
  // Admission/policy are async; dispatch is the explicit ownership event.
  await new Promise(resolve => { setImmediate(resolve); }); assert.equal(dispatches, 1);
  const queuedController = new AbortController();
  const queued = service.ingestArtworkBuffer({ buffer: input.buffer, signal: queuedController.signal });
  const queuedRejection = assert.rejects(queued, { code: 'artwork_ingestion_cancelled' });
  controller.abort(); await f.killed; f.child.stdout.write(output()); f.child.emit('exit', 0, null);
  assert.equal(gate.getState().active, 1); assert.equal(gate.getState().queued, 1); assert.equal(publications, 0);
  queuedController.abort(); await queuedRejection; f.child.emit('close', 0, null); await rejection;
  assert.deepEqual(gate.getState(), { active: 0, queued: 0, queuedBytes: 0 }); assert.equal(publications, 0);
});

test('worker failures drain on stream/spawn errors and project fixed diagnostics', async () => {
  for (const kind of ['error', 'stdin', 'stdout', 'protocol']) {
    const f = fixture(); const pending = f.service.processArtworkBuffer(input);
    const rejected = assert.rejects(pending, error => error.code === 'artwork_worker_failed' && !error.message.includes('private') && !error.cause);
    if (kind === 'protocol') f.child.stdout.write(Buffer.alloc(1025));
    else (kind === 'error' ? f.child : f.child[kind]).emit('error', new Error('private path'));
    await f.killed; f.child.emit('close', null, 'SIGKILL'); await rejected;
  }
  for (const original of [new Error('private'), null]) {
    await assert.rejects(createArtworkWorkerService({ spawnFn: () => { throw original; } }).processArtworkBuffer(input), { code: 'artwork_worker_failed' });
  }
});

test('worker refuses invalid inputs before spawning and checks the monotonic deadline at close', async () => {
  let spawns = 0; const service = createArtworkWorkerService({ spawnFn: () => { spawns++; } });
  for (const options of [{ ...input, maxBytes: 4 }, { ...input, maxBytes: 101 * 1024 * 1024 }, { ...input, maxDimensionPixels: 8193 },
    { ...input, signal: AbortSignal.abort() }]) await assert.rejects(service.processArtworkBuffer(options));
  assert.equal(spawns, 0);
  let time = 0; const f = fixture({ timeoutMs: 1000, now: () => time });
  const pending = f.service.processArtworkBuffer(input); f.child.stdout.write(output()); time = 1000;
  f.child.emit('close', 0, null); await assert.rejects(pending, { code: 'artwork_worker_timeout' });
  for (const timeoutMs of [0, -1, 1.5, 60_001]) assert.throws(() => createArtworkWorkerService({ timeoutMs }), TypeError);
});

test('owned worker availability failure escapes a real fetch batch without provider-absence backoff', async () => {
  const f = fixture(); let backoffs = 0;
  const ingestion = { ingestArtworkBuffer: () => f.service.processArtworkBuffer(input) };
  const fetch = createArtworkFetchService({ artworkIngestionService: ingestion,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) }, listArtworkAssignmentsFn: async () => [],
    downloadImageFn: async () => input.buffer,
    fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/image.png' }] },
    artworkFetchBackoffService: { shouldBackoff: async () => ({ active: false }), recordFailure: async () => { backoffs++; }, clearFailure: async () => {} },
  });
  const pending = fetch.resolveArtworkBatch([{ ownerType: 'musicbrainz_artist', ownerId: 'artist', artworkRole: 'artist_thumbnail' }]);
  const rejected = assert.rejects(pending, { code: 'artwork_worker_failed', status: 503 });
  await new Promise(resolve => { setImmediate(resolve); }); f.child.emit('close', null, 'SIGKILL'); await rejected; assert.equal(backoffs, 0);
});
