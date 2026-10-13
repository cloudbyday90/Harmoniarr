/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorTrackRootContextStore } from '../../src/server/metadata/operator-track-root-context-store.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { getDefaultSettings } from '../../src/server/validators/settings-validator.js';

test('default composition uses one fresh joined query on the owning client for every root check', async () => {
  let reads = 0; let disabled = false;
  const queryable = { query: async (sql, values) => {
    reads++; assert.equal(sql.includes('LEFT JOIN app_settings'), true); assert.deepEqual(values, ['owner']);
    return { rows: [{ id: 'owner', is_disabled: disabled, managed_library_relative_root: 'private',
      has_music_root_setting: true, music_root: '/music' }] };
  } };
  const service = createOperatorTrackDeliveryPlanService({ getPoolFn: () => assert.fail('Borrowed client owns this read'), realpathFn: async path => path });
  assert.equal(await service.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable }), '/music/users/private');
  disabled = true;
  await assert.rejects(service.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable }), { code: 'operator_track_scope_verification_required' });
  assert.equal(reads, 2);
});

test('joined context uses the borrowed client, binds the exact owner and preserves missing versus null settings', async () => {
  const owner = { id: 'owner', is_disabled: false, managed_library_relative_root: 'private' };
  let row; let calls = 0;
  const queryable = { query: async (sql, values) => {
    calls++; assert.deepEqual(values, ['owner']); assert.ok(sql.includes('LEFT JOIN app_settings'));
    assert.equal(sql.includes('owner.id=$1::uuid'), true); return { rows: row ? [row] : [] };
  } };
  const store = createOperatorTrackRootContextStore({ getPoolFn: () => assert.fail('No extra checkout') });
  for (const [hasMusicRootSetting, musicRoot] of [[false, null], [true, null], [true, '/music']]) {
    row = { ...owner, has_music_root_setting: hasMusicRootSetting, music_root: musicRoot };
    assert.deepEqual(await store.readOwnerRootContext({ ownerId: 'owner', queryable }), { owner, hasMusicRootSetting, musicRoot });
  }
  row = null; assert.equal(await store.readOwnerRootContext({ ownerId: 'owner', queryable }), null); assert.equal(calls, 4);
});

test('fresh joined roots retain default, explicit-null, disabled-owner and canonical-root refusal behavior', async () => {
  const owner = { id: 'owner', is_disabled: false, managed_library_relative_root: 'private' };
  let context = { owner, hasMusicRootSetting: true, musicRoot: '/music' }; const queryable = {}; let reads = 0;
  const service = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true,
    store: { readOwnerRootContext: async input => { reads++; assert.deepEqual(input, { ownerId: 'owner', queryable }); return context; },
      readDeliveryOwner: () => assert.fail('Joined path selected') }, realpathFn: async path => path });
  const resolve = () => service.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable });
  assert.equal(await resolve(), '/music/users/private');
  context = { ...context, musicRoot: '/changed' }; assert.equal(await resolve(), '/changed/users/private');
  context = { ...context, musicRoot: null };
  await assert.rejects(resolve(), { code: 'operator_track_scope_verification_required' });
  context = { ...context, hasMusicRootSetting: false };
  assert.equal(await resolve(), getDefaultSettings().paths.music.replace(/\/+$/u, '') + '/users/private');
  context = { ...context, owner: { ...owner, is_disabled: true } };
  await assert.rejects(resolve(), { code: 'operator_track_scope_verification_required' });
  context = null; await assert.rejects(resolve(), { code: 'operator_track_scope_verification_required' });
  assert.equal(reads, 6);
  const redirected = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true,
    store: { readOwnerRootContext: async () => ({ owner, hasMusicRootSetting: true, musicRoot: '/music' }) },
    realpathFn: async path => path.endsWith('/private') ? '/other/private' : path });
  await assert.rejects(redirected.resolvePrivateOwnerRoot({ ownerId: 'owner' }), { code: 'operator_track_scope_verification_required' });
});

test('explicit settings and custom loaders preserve their injection contract and original Error/null', async () => {
  const owner = { is_disabled: false, managed_library_relative_root: 'private' }; const queryable = {};
  let loads = 0; const store = { readDeliveryOwner: async input => { assert.equal(input.queryable, queryable); return owner; },
    readOwnerRootContext: () => assert.fail('Custom settings source must remain authoritative') };
  const service = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true, store, realpathFn: async path => path,
    loadSettingsFn: async client => { loads++; assert.equal(client, queryable); return { paths: { music: '/custom' } }; } });
  assert.equal(await service.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable }), '/custom/users/private');
  assert.equal(await service.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable, settings: { paths: { music: '/explicit' } } }), '/explicit/users/private');
  assert.equal(loads, 1);
  for (const error of [new Error('Original database failure'), null]) {
    const failing = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true,
      store: { readOwnerRootContext: async () => { throw error; } } });
    let caught = false;
    try { await failing.resolvePrivateOwnerRoot({ ownerId: 'owner', queryable }); }
    catch (actual) { caught = true; assert.equal(actual, error); }
    assert.equal(caught, true);
  }
});
