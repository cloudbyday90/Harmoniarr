/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPlexDirectSignInService } from '../../src/server/integrations/plex/plex-direct-sign-in-service.js';
import { invalidPlexCallback } from '../../src/server/integrations/plex/plex-callback-policy.js';

const browserBinding = Buffer.alloc(32, 1).toString('base64url');
function fixture(options = {}) {
  const records = new Map(), calls = [];
  const callbackStateService = {
    resolveClientIdentifier: async () => 'client-identifier',
    create: async input => { records.set(input.state, { ...input, proof: { id: randomUUID() } }); return '2050-01-01T00:00:00.000Z'; },
    read: async input => { const row = records.get(input.state); if (!row || input.browserBinding !== row.browserBinding) throw invalidPlexCallback(); return row; },
  };
  const service = createPlexDirectSignInService({ callbackStateService,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example.test' } }),
    findLinkedUserFn: async input => { calls.push({ lookup: input }); return options.unlinked ? null : { id: 'user', auth_subject: 'plex-uuid' }; },
    issueLinkedLogin: async input => { calls.push({ issue: input }); if (options.issueError) throw options.issueError; return { user: { id: 'user' }, issuedSession: { refreshToken: 'private-fixture' } }; },
    plexHttpClient: { createPin: async () => ({ id: 123, code: 'PINCODE' }), readPin: async () => ({ authToken: options.noToken ? null : 'fixture-token' }),
      fetchCurrentUser: async () => ({ id: 42, uuid: 'plex-uuid', restricted: options.restricted ?? false }) },
  });
  return { service, records, calls, state: () => [...records.keys()][0] };
}

test('startSignIn preserves the authorization DTO and stores only the normalized app continuation', async () => {
  const f = fixture(), result = await f.service.startSignIn({ browserBinding, redirectTo: '/app/activity/blocklist' });
  assert.equal(result.provider, 'plex'); assert.match(result.authorizationUrl, /^https:\/\/app\.plex\.tv\/auth#\?/u);
  assert.equal(result.redirectTo, '/app/activity/blocklist'); assert.equal(f.records.get(f.state()).pinId, '123');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(browserBinding, 'u'));
});

test('completeSignIn delegates exact provider proof and state consumption without post-commit cleanup', async () => {
  const f = fixture(); await f.service.startSignIn({ browserBinding, redirectTo: '/app/activity' });
  const proof = f.records.get(f.state()).proof, metadata = { ipAddress: '127.0.0.1', userAgent: 'fixture' };
  const result = await f.service.completeSignIn({ browserBinding, state: f.state(), requestMetadata: metadata });
  assert.equal(result.redirectTo, '/app/activity');
  assert.deepEqual(f.calls, [{ lookup: { plexId: '42', plexUuid: 'plex-uuid' } }, { issue: {
    provider: 'plex', subject: 'plex-uuid', userId: 'user', requestMetadata: metadata, callbackState: proof,
  } }]);
  assert.equal(f.records.size, 1); // Only the real login owner may consume persisted state.
});

test('binding rejection precedes provider work and provider refusals never invoke local issuance', async () => {
  for (const options of [{ restricted: true }, { unlinked: true }, { noToken: true }]) {
    const f = fixture(options); await f.service.startSignIn({ browserBinding });
    await assert.rejects(f.service.completeSignIn({ browserBinding, state: f.state() }));
    assert.ok(!f.calls.some(value => value.issue)); assert.equal(f.records.size, 1);
  }
  const f = fixture(); await f.service.startSignIn({ browserBinding });
  await assert.rejects(f.service.completeSignIn({ browserBinding: Buffer.alloc(32, 2).toString('base64url'), state: f.state() }), { code: 'plex_sign_in_state_invalid' });
  assert.equal(f.calls.length, 0); await assert.rejects(f.service.startSignIn({}), { code: 'plex_sign_in_state_invalid' });
});

test('local issuance uncertainty propagates without consuming or retrying state in the adapter', async () => {
  const issueError = new Error('uncertain local commit'), f = fixture({ issueError }); await f.service.startSignIn({ browserBinding });
  await assert.rejects(f.service.completeSignIn({ browserBinding, state: f.state() }), error => error === issueError);
  assert.equal(f.calls.filter(value => value.issue).length, 1); assert.equal(f.records.size, 1);
});

test('startSignIn rejects external, backslash and encoded unsafe continuations', async () => {
  for (const redirectTo of ['https://evil.test', '//evil.test', '/\\evil.test', '/app/../login', '/app/%2f%2fevil', '/api/v1']) {
    const f = fixture(); assert.equal((await f.service.startSignIn({ browserBinding, redirectTo })).redirectTo, '/app');
  }
});
