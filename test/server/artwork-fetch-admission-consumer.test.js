import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';
import { createArtworkFetchAdmission } from '../../src/server/artwork/artwork-fetch-admission.js';

const request = ownerId => ({ ownerId, ownerType: 'musicbrainz_artist', artworkRole: 'artist_thumbnail' });
const asset = { id: 'asset', dominantChroma: null, dominantHue: null, dominantLightness: null };
const policy = { fetch: { enabled: true }, limits: {} };
function service(overrides) {
  return createArtworkFetchService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => policy },
    listArtworkAssignmentsFn: async () => [], artworkAssignmentService: { assignPreferredArtwork: async () => {} },
    artworkIngestionService: { ingestArtworkBuffer: async () => ({ asset }) },
    fanartTvClient: { fetchArtistImages: async () => [{ imageType: 'artistthumb', url: 'https://assets.fanart.tv/image.png' }] },
    downloadImageFn: async () => Buffer.from('image'), ...overrides });
}

test('default service shares two slots across overlapping batches and singles through final publication', async () => {
  const entered = Promise.withResolvers(); const held = Promise.withResolvers();
  let downloads = 0; let assignments = 0; let policyReads = 0;
  const fetch = service({
    artworkPolicyService: { getArtworkRuntimePolicy: async () => { policyReads++; return policy; } },
    downloadImageFn: async () => { downloads++; return Buffer.from('image'); },
    artworkAssignmentService: { assignPreferredArtwork: async () => {
      assignments++; if (assignments === 2) entered.resolve(); if (assignments <= 2) await held.promise;
    } },
  });
  const batch = fetch.resolveArtworkBatch(Array.from({ length: 50 }, (_, i) => request(`batch-${i}`)));
  let single; let other;
  try {
    await Promise.race([entered.promise, batch.then(() => assert.fail('batch finished before hold'))]);
    single = fetch.resolveArtwork(request('single'));
    other = fetch.resolveArtworkBatch([request('other-1'), request('other-2')]);
    await Promise.resolve();
    assert.equal(downloads, 2); assert.equal(assignments, 2); assert.equal(policyReads, 2);
  } finally { held.resolve(); await Promise.allSettled([batch, single, other]); }
  assert.equal(Object.keys(await batch).length, 50); assert.equal((await single).assetId, 'asset');
  assert.equal(Object.keys(await other).length, 2); assert.equal(downloads, 53); assert.equal(assignments, 53);
});

test('batch capacity refusal drains siblings and never records provider absence/backoff', async () => {
  const gate = createArtworkFetchAdmission({ concurrency: 1, maxQueued: 0 });
  const entered = Promise.withResolvers(); const held = Promise.withResolvers(); let failures = 0; let calls = 0;
  const fetch = service({ artworkFetchAdmission: gate,
    downloadImageFn: async () => { calls++; return Buffer.from('image'); },
    artworkAssignmentService: { assignPreferredArtwork: async () => { entered.resolve(); await held.promise; } },
    artworkFetchBackoffService: { shouldBackoff: async () => ({ active: false }), clearFailure: async () => {}, recordFailure: async () => { failures++; } },
  });
  const batch = fetch.resolveArtworkBatch([request('first'), request('overflow'), request('never')]);
  let settled = false; const check = assert.rejects(batch, { code: 'artwork_fetch_capacity', status: 503 }).then(() => { settled = true; });
  try { await entered.promise; await Promise.resolve(); assert.equal(settled, false); assert.equal(calls, 1); }
  finally { held.resolve(); await check; }
  assert.equal(failures, 0); assert.deepEqual(gate.getState(), { active: 0, queued: 0 });
});

test('queued service cancellation skips provider work and reads fresh policy only on admission', async () => {
  const gate = createArtworkFetchAdmission({ concurrency: 1 }); const entered = Promise.withResolvers(); const held = Promise.withResolvers();
  let enabled = true; let downloads = 0;
  const fetch = service({ artworkFetchAdmission: gate,
    artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ ...policy, fetch: { enabled } }) },
    downloadImageFn: async () => { downloads++; entered.resolve(); await held.promise; return Buffer.from('image'); },
  });
  const active = fetch.resolveArtwork(request('active')); await entered.promise;
  const controller = new AbortController();
  const cancelled = fetch.resolveArtwork({ ...request('cancelled'), signal: controller.signal });
  const check = assert.rejects(cancelled, { code: 'artwork_fetch_cancelled' });
  const next = fetch.resolveArtwork(request('policy-changed'));
  controller.abort(); await check; enabled = false; held.resolve(); await active;
  assert.equal((await next).url, null); assert.equal(downloads, 1);
  assert.deepEqual(gate.getState(), { active: 0, queued: 0 });
});

test('batch input bounds apply below routes and ordinary item failures preserve partial results', async () => {
  const fetch = service({ downloadImageFn: async () => { throw new Error('image unavailable'); } });
  await assert.rejects(fetch.resolveArtworkBatch(Array.from({ length: 51 }, () => request('x'))), { status: 400, code: 'validation_error' });
  await assert.rejects(fetch.resolveArtworkBatch(null), { status: 400 });
  for (const invalid of [null, { ...request('x'), ownerId: Buffer.alloc(1) }, { ...request('x'), ownerId: 'x'.repeat(257) },
    { ...request('x'), refresh: 'true' }]) {
    await assert.rejects(fetch.resolveArtwork(invalid), { status: 400 });
    await assert.rejects(fetch.resolveArtworkBatch([invalid]), { status: 400 });
  }
  await assert.rejects(fetch.resolveArtworkBatch(new Array(2)), { status: 400 });
  assert.deepEqual(await fetch.resolveArtworkBatch([]), {});
  const result = await fetch.resolveArtworkBatch([request('failed')]);
  assert.equal(result['musicbrainz_artist:failed:artist_thumbnail'].assetId, null);
  await assert.rejects(fetch.resolveArtworkBatch([request('cancelled')], { signal: AbortSignal.abort() }), { code: 'artwork_fetch_cancelled' });
});
