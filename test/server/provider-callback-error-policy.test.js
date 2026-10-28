/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/api-error.js';
import { selectProviderCallbackErrorCode } from '../../src/server/integrations/providers/provider-callback-error-policy.js';

const outcomes = {
  spotify: ['spotify_oauth_failed', 'spotify_oauth_state_invalid', 'spotify_oauth_authorization_changed', 'spotify_oauth_link_changed',
    'spotify_client_id_required', 'spotify_oauth_token_exchange_failed', 'spotify_invalid_response'],
  youtube: ['youtube_oauth_failed', 'youtube_oauth_state_invalid', 'youtube_oauth_authorization_changed', 'youtube_oauth_link_changed',
    'youtube_client_id_required', 'youtube_client_secret_required', 'youtube_oauth_token_exchange_failed', 'youtube_invalid_response'],
  plex: ['plex_link_failed', 'plex_link_state_invalid', 'plex_link_authorization_changed', 'plex_link_not_claimed', 'plex_link_profile_invalid',
    'plex_link_restricted_account', 'plex_pin_invalid_response', 'plex_pin_unauthorized', 'plex_pin_read_failed', 'plex_user_invalid_response',
    'plex_token_invalid', 'plex_user_fetch_failed', 'plex_request_timeout', 'plex_request_busy', 'plex_request_closed', 'plex_request_unavailable',
    'plex_request_oversized', 'plex_request_redirect', 'plex_request_invalid'],
};
for (const [provider, codes] of Object.entries(outcomes)) {
  const fallback = codes[0];
  test(`${provider} callback preserves reviewed owner and transport outcomes without reading private diagnostics`, () => {
    for (const code of codes) {
      const error = Object.freeze({ code, get message() { return assert.fail('Private message read'); }, get cause() { return assert.fail('Private cause read'); },
        get details() { return assert.fail('Private details read'); }, toJSON() { assert.fail('Private serialization'); } });
      assert.equal(selectProviderCallbackErrorCode(provider, error), code);
    }
  });
  test(`${provider} callback refuses arbitrary, cross-provider, prefix-only and start-only codes without coercion`, () => {
    const values = [null, undefined, false, 0, 1n, Symbol('private'), [], ['private'], new String(codes[1]),
      { toString() { assert.fail('Code coercion'); } }, '__proto__', 'constructor', 'toString', 'PRIVATE /data/key.pem', 'x'.repeat(8192),
      `${provider}_PRIVATE`, `${provider}_oauth_base_url_required`, 'plex_pin_create_failed',
      ...Object.entries(outcomes).filter(([other]) => other !== provider).flatMap(([, entries]) => entries)];
    for (const code of values) assert.equal(selectProviderCallbackErrorCode(provider, { code }), fallback);
    for (const error of [null, undefined, false, 0, 1n, Symbol('private'), 'private', new Proxy({}, { get() { throw new Error('PRIVATE'); } })]) {
      assert.equal(selectProviderCallbackErrorCode(provider, error), fallback);
    }
  });
  test(`${provider} callback uses captured public codes rather than later mutation`, () => {
    const known = createApiError(400, codes[1], 'PRIVATE');
    Object.defineProperty(known, 'code', { get() { return assert.fail('Mutable code read'); } });
    assert.equal(selectProviderCallbackErrorCode(provider, known), codes[1]);
    const unknown = createApiError(400, 'PRIVATE', 'PRIVATE'); unknown.code = codes[1];
    assert.equal(selectProviderCallbackErrorCode(provider, unknown), fallback);
  });
}
test('callback provider selection rejects unsupported names without prototype lookup or coercion', () => {
  for (const provider of ['__proto__', 'constructor', 'toString', 'apple_music', null, { toString() { assert.fail('Provider coercion'); } }]) {
    assert.throws(() => selectProviderCallbackErrorCode(provider, null), { name: 'TypeError', message: 'Unsupported callback provider' });
  }
});
