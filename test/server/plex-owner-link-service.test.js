import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createPlexOwnerLinkService } from '../../src/server/integrations/plex/plex-owner-link-service.js';
import { ownerLinkSessionAuthority, parseOwnerLinkPending, normalizeOwnerLinkProfile, ownerLinkBindingHash, captureOwnerLinkProof } from '../../src/server/integrations/plex/plex-owner-link-policy.js';
import { readPlexBrowserBinding, plexBrowserBindingCookieName } from '../../src/server/plex-browser-binding.js';

const session = { appUserId: randomUUID(), refreshTokenId: randomUUID(), tokenFamilyId: randomUUID(), refreshToken: 'fixture-refresh-token' };
const browserBinding = Buffer.alloc(32, 1).toString('base64url');
const authority = ownerLinkSessionAuthority(session);
const context = { clientIdentifier: randomUUID(), linkRevision: randomUUID() };
const expiresAt = '2026-10-27T12:10:00.000Z';
const pending = { ...context, authority, pinId: '42', expiresAt };
function fixture(t, overrides = {}) {
  const commandService = { prepare: t.mock.fn(async () => context), createPending: t.mock.fn(async () => ({ expiresAt })),
    complete: t.mock.fn(async () => ({ provider: 'plex', status: { linked: true } })), clear: t.mock.fn(async () => ({ status: { linked: false } })) };
  const stateService = { read: t.mock.fn(async () => pending) };
  const plexHttpClient = { createPin: t.mock.fn(async () => ({ id: 42, code: 'fixture-pin' })), readPin: t.mock.fn(async () => ({ authToken: 'fixture-token' })),
    fetchCurrentUser: t.mock.fn(async () => ({ id: 7, uuid: 'owner', email: 'Owner@Example.test', username: 'Owner' })) };
  return { commandService, stateService, plexHttpClient, service: createPlexOwnerLinkService({ commandService, stateService, plexHttpClient,
    loadSettingsFn: async () => ({ system: { baseUrl: 'https://harmoniarr.example' } }), ...overrides }) };
}
test('owner linking forwards browser and exact session authority to the transactional owner', async t => {
  const f = fixture(t), result = await f.service.startLink({ session, browserBinding });
  const parameters = new URLSearchParams(result.authorizationUrl.split('#?')[1]);
  assert.equal(parameters.get('code'), 'fixture-pin');
  const callback = new URL(parameters.get('forwardUrl'));
  assert.equal(callback.origin, 'https://harmoniarr.example');
  assert.equal(callback.pathname, '/api/v1/providers/plex/link/callback');
  assert.deepEqual(f.commandService.prepare.mock.calls[0].arguments, [authority]);
  assert.deepEqual(f.commandService.createPending.mock.calls[0].arguments[0], { authority, state: callback.searchParams.get('state'), browserBinding, ...context, pinId: '42', requestMetadata: {} });
  assert.deepEqual(Object.keys(result).sort(), ['authorizationUrl', 'expiresAt', 'provider']);
  assert.ok(!JSON.stringify(result).includes(browserBinding));
});
test('owner linking refuses missing session or browser binding before database and provider work', async t => {
  const f = fixture(t);
  await assert.rejects(f.service.startLink({ browserBinding }), { code: 'plex_link_authorization_changed' });
  await assert.rejects(f.service.startLink({ session }), { code: 'plex_link_state_invalid' });
  assert.equal(f.commandService.prepare.mock.callCount(), 0); assert.equal(f.plexHttpClient.createPin.mock.callCount(), 0);
});
test('owner callback resolves state before provider calls and delegates normalized credential publication', async t => {
  const f = fixture(t), state = randomUUID();
  await f.service.completeLink({ state, browserBinding });
  assert.deepEqual(f.stateService.read.mock.calls[0].arguments, [{ state, browserBinding }]);
  const accepted = f.commandService.complete.mock.calls[0].arguments[0];
  assert.equal(accepted.pending, pending); assert.equal(accepted.accessToken, 'fixture-token');
  assert.equal(accepted.profile.email, 'owner@example.test'); assert.equal(accepted.profile.id, '7');
});
test('owner callback never calls the provider after state refusal', async t => {
  const f = fixture(t, { stateService: { read: async () => { throw new Error('state refused'); } } });
  await assert.rejects(f.service.completeLink({ state: randomUUID(), browserBinding }), /state refused/u);
  assert.equal(f.plexHttpClient.readPin.mock.callCount(), 0); assert.equal(f.commandService.complete.mock.callCount(), 0);
});
test('owner callback refuses restricted identities before token publication', async t => {
  const f = fixture(t); f.plexHttpClient.fetchCurrentUser.mock.mockImplementation(async () => ({ id: 7, restricted: true }));
  await assert.rejects(f.service.completeLink({ browserBinding }), { code: 'plex_link_restricted_account' });
  assert.equal(f.commandService.complete.mock.callCount(), 0);
});
test('owner unlink delegates the exact current session authority', async t => {
  const f = fixture(t); await f.service.clearLink({ session });
  assert.deepEqual(f.commandService.clear.mock.calls[0].arguments, [{ authority, requestMetadata: {} }]);
});
test('owner pending parser requires version, purpose, browser binding, live expiry and exact authority', () => {
  const value = { ...pending, version: 1, kind: 'owner_link', browserBindingHash: ownerLinkBindingHash(browserBinding) };
  const parse = input => parseOwnerLinkPending(JSON.stringify(input), browserBinding, '2026-10-27T12:00:00.000Z');
  assert.deepEqual(parse(value), pending);
  for (const delta of [{ version: 0 }, { kind: 'sign_in' }, { browserBindingHash: '0'.repeat(64) }, { authority: {} }, { expiresAt: '2020-01-01T00:00:00.000Z' }, { linkRevision: '' }]) {
    assert.throws(() => parse({ ...value, ...delta }), { code: 'plex_link_state_invalid' });
  }
});
test('owner proof captures ciphertext by value and rejects sign-in state names', () => {
  const value = { id: randomUUID(), name: 'providers.plex.link.pending.' + randomUUID(), encryptedValue: Buffer.from('cipher'), revision: '2026-10-27 12:00:00.000001+00', expiresAt };
  const proof = captureOwnerLinkProof(value); value.encryptedValue.fill(0); assert.equal(proof.encryptedValue.toString(), 'cipher');
  assert.throws(() => captureOwnerLinkProof({ ...value, name: 'auth.plex.sign_in.pending.' + randomUUID() }), { code: 'plex_link_state_invalid' });
});
test('owner browser cookie is separate from sign-in and rejects duplicate owner bindings', () => {
  assert.equal(plexBrowserBindingCookieName(true, 'owner_link'), '__Host-harmoniarr_plex_link_binding');
  const request = cookie => ({ headers: { cookie }, deploymentSecurityPolicy: { secureCookies: false } });
  assert.equal(readPlexBrowserBinding(request('harmoniarr_plex_binding=' + browserBinding), 'owner_link'), null);
  assert.equal(readPlexBrowserBinding(request('harmoniarr_plex_link_binding=' + browserBinding), 'owner_link'), browserBinding);
  assert.equal(readPlexBrowserBinding(request(`harmoniarr_plex_link_binding=${browserBinding}; harmoniarr_plex_link_binding=${browserBinding}`), 'owner_link'), null);
});
test('owner profile bounds reject unusable identity and limit optional display metadata', () => {
  assert.throws(() => normalizeOwnerLinkProfile({}), { code: 'plex_link_profile_invalid' });
  assert.throws(() => normalizeOwnerLinkProfile({ uuid: 'x'.repeat(257) }), { code: 'plex_link_profile_invalid' });
  assert.equal(normalizeOwnerLinkProfile({ id: 7, title: 'x'.repeat(300) }).title.length, 256);
});
