/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import { createProviderStatusService } from '../../src/server/integrations/providers/provider-status-service.js';
import { createProviderModule } from '../../src/server/provider-module.js';

const failed = provider => ({ provider, availability: 'unavailable', code: 'provider_status_unavailable' });
test('provider status preserves successful objects and captures only supported reader functions', async () => {
  const apple = { configured: true, localSigning: { state: 'invalid' } }, readers = { appleMusic: () => apple, spotify: () => ({ linked: false }) };
  const service = createProviderStatusService({ readers }); readers.appleMusic = () => { throw new Error('wrong reader'); };
  const result = await service.buildStatuses(); assert.equal(result.appleMusic, apple); assert.deepEqual(result.spotify, { linked: false });
  assert.deepEqual(result.statusSummary, { state: 'complete', unavailableProviders: [] });
  assert.throws(() => createProviderStatusService({ readers: { unknown: () => ({}) } }), TypeError);
  assert.throws(() => createProviderStatusService({ readers: { spotify: null } }), TypeError);
});

for (const [key, provider] of [['plex', 'plex'], ['spotify', 'spotify'], ['youtube', 'youtube'], ['appleMusic', 'apple_music']]) {
  test(`provider status isolates ${key} without false unlinked/configured fields or raw diagnostics`, async () => {
    let calls = 0; const readers = Object.fromEntries(['plex', 'spotify', 'youtube', 'appleMusic'].map(name => [name, () => {
      calls++; if (name === key) throw Object.assign(new Error('PRIVATE-status-sentinel'), { cause: { key: 'PRIVATE-status-sentinel' }, code: 'PRIVATE-code' });
      return { observed: name };
    }]));
    const result = await createProviderStatusService({ readers }).buildStatuses();
    assert.deepEqual(result[key], failed(provider)); assert.deepEqual(result.statusSummary, { state: 'partial', unavailableProviders: [key] });
    for (const name of Object.keys(readers).filter(candidate => candidate !== key)) assert.deepEqual(result[name], { observed: name });
    assert.ok(!JSON.stringify(result).includes('PRIVATE')); assert.equal(calls, 4);
  });
}

test('all local read failures produce an explicit unavailable representation, including non-Error rejection', async () => {
  const result = await createProviderStatusService({ readers: { plex: () => { throw NaN; }, spotify: async () => { throw null; }, appleMusic: () => { throw undefined; } } }).buildStatuses();
  assert.deepEqual(result, { plex: failed('plex'), spotify: failed('spotify'), appleMusic: failed('apple_music'), statusSummary: { state: 'unavailable', unavailableProviders: ['plex', 'spotify', 'appleMusic'] } });
});

test('native database and existing bounded lookup failures remain sanitized shared 503', async () => {
  for (const error of [
    ...['ECONNREFUSED', 'ECONNRESET', '57P01', '08006', 'database_pool_busy', 'database_unavailable', 'auth_lookup_unavailable', 'session_lookup_unavailable'].map(code => Object.assign(new Error('PRIVATE-status-sentinel'), { code })),
    new Error('timeout exceeded when trying to connect'),
  ]) {
    await assert.rejects(createProviderStatusService({ readers: { appleMusic: () => { throw error; } } }).buildStatuses(), value => value.status === 503 && value.code === 'database_unavailable'
      && value.message === 'Database is temporarily unavailable' && value.cause === undefined);
  }
});

test('started independent readers settle before a shared failure is returned, without retry or cancellation', async () => {
  const held = Promise.withResolvers(); let calls = 0, settled = false;
  const service = createProviderStatusService({ readers: {
    plex: () => { calls++; throw Object.assign(new Error('PRIVATE'), { code: 'ECONNREFUSED' }); },
    spotify: () => { calls++; return held.promise; },
  } });
  const work = assert.rejects(service.buildStatuses(), { code: 'database_unavailable' }).then(() => { settled = true; });
  await turn(); assert.equal(calls, 2); assert.equal(settled, false);
  held.resolve({ linked: false }); await work; assert.equal(settled, true); assert.equal(calls, 2);
});

test('borrowed queryables are forwarded serially and survive local failure without ownership operations', async () => {
  const queryable = {}, order = []; let active = 0, peak = 0;
  const read = name => async target => {
    assert.equal(target, queryable); active++; peak = Math.max(peak, active); order.push(name); await turn(); active--;
    if (name === 'spotify') throw new Error('PRIVATE'); return { name };
  };
  const result = await createProviderStatusService({ readers: { appleMusic: read('appleMusic'), youtube: read('youtube'), spotify: read('spotify') } }).buildStatuses({ queryable });
  assert.equal(peak, 1); assert.deepEqual(order, ['spotify', 'youtube', 'appleMusic']); assert.deepEqual(result.spotify, failed('spotify'));
  assert.deepEqual(result.youtube, { name: 'youtube' }); assert.deepEqual(queryable, {});
});

test('borrowed database failure stops new reader admission after the current read settles', async () => {
  let nextCalls = 0;
  const service = createProviderStatusService({ readers: { plex: async () => { throw Object.assign(new Error('PRIVATE'), { code: '57P01' }); }, spotify: () => { nextCalls++; } } });
  await assert.rejects(service.buildStatuses({ queryable: {} }), { code: 'database_unavailable' }); assert.equal(nextCalls, 0);
});

test('provider module routes use the aggregate factory while command owners remain separate', async () => {
  const service = buildStatus => ({ buildStatus });
  const module = createProviderModule({ providerHttpService: {}, providerClientResolverService: {}, providerCollectionAccessCheckService: {},
    appleMusicStatusService: service(() => { throw new Error('PRIVATE'); }), plexOwnerLinkService: service(() => ({ linked: false })),
    spotifyOAuthService: service(() => ({ linked: true })), youtubeOAuthService: service(() => ({ linked: false })),
  });
  const result = await module.routeDependencies.buildProviderStatuses(); assert.equal(result.spotify.linked, true); assert.deepEqual(result.appleMusic, failed('apple_music'));
  assert.equal(module.routeDependencies.buildProviderStatuses, module.providerStatusService.buildStatuses);
});
