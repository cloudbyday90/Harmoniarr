/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readProviderCallbackIntent, clearProviderCallbackQuery, readSavedProviderLink, buildProviderCallbackFeedback } from '../../src/client/lib/provider-callback-feedback-policy.js';

for (const provider of ['spotify', 'youtube', 'plex']) {
  test(`${provider} return captures fixed guidance without treating linked as success`, () => {
    const key = provider + 'OAuth';
    assert.deepEqual(readProviderCallbackIntent({ [key]: 'linked' }), { provider, guidance: 'check' });
    assert.deepEqual(readProviderCallbackIntent({ [key]: 'failed', code: provider + (provider === 'plex' ? '_link_state_invalid' : '_oauth_state_invalid') }), { provider, guidance: 'restart' });
    for (const code of ['PRIVATE', '__proto__', 'constructor', 'spotify_oauth_state_invalid-PRIVATE', 'x'.repeat(8192), null, [], ['PRIVATE'], { toString() { assert.fail('Code coercion'); } }]) {
      const result = readProviderCallbackIntent({ [key]: 'failed', code });
      assert.deepEqual(result, { provider, guidance: 'review' });
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE/u);
    }
    assert.deepEqual(readProviderCallbackIntent({ [key]: 'linked', code: 'PRIVATE' }), { provider, guidance: 'review' });
    const body = { [provider]: { linked: true }, statusSummary: { state: 'complete', unavailableProviders: [] } };
    assert.equal(readSavedProviderLink(body, provider), 'present'); body[provider].linked = false;
    assert.equal(readSavedProviderLink(body, provider), 'absent');
  });
  test(`${provider} status refuses missing, unavailable, malformed and truthy observations`, () => {
    for (const payload of [null, {}, { [provider]: { linked: true } },
      ...['unavailable', 'PRIVATE', null].map(availability => ({ [provider]: { linked: true, availability }, statusSummary: { state: 'complete', unavailableProviders: [] } })),
      { [provider]: { linked: true, provider: 'PRIVATE' }, statusSummary: { state: 'complete', unavailableProviders: [] } },
      ...['true', 1, null, [], {}].map(linked => ({ [provider]: { linked }, statusSummary: { state: 'complete', unavailableProviders: [] } })),
      { [provider]: { linked: true }, statusSummary: { state: 'unavailable', unavailableProviders: [] } },
      { [provider]: { linked: true }, statusSummary: { state: 'partial', unavailableProviders: [provider] } }]) {
      assert.equal(readSavedProviderLink(payload, provider), 'unknown');
    }
    assert.equal(readSavedProviderLink({ [provider]: { linked: true }, statusSummary: { state: 'partial', unavailableProviders: ['appleMusic'] } }, provider), 'present');
  });
}
test('ambiguous, duplicate and invalid flags remain generic and ordinary queries do not create feedback', () => {
  for (const query of [null, undefined, {}, { code: 'PRIVATE' }, { keep: 'yes' }]) assert.equal(readProviderCallbackIntent(query), null);
  for (const query of [{ spotifyOAuth: ['linked'] }, { youtubeOAuth: null }, { plexOAuth: 'PRIVATE' }, { spotifyOAuth: 'failed', youtubeOAuth: 'linked' }]) {
    assert.deepEqual(readProviderCallbackIntent(query), { provider: null, guidance: 'review' });
  }
});
test('provider-specific recovery instructions cannot be selected with another provider code', () => {
  for (const [provider, code, guidance] of [['spotify', 'spotify_client_id_required', 'credentials'], ['youtube', 'youtube_client_secret_required', 'credentials'],
    ['youtube', 'youtube_oauth_authorization_changed', 'session'], ['plex', 'plex_link_not_claimed', 'claim'], ['plex', 'plex_link_restricted_account', 'owner']]) {
    assert.deepEqual(readProviderCallbackIntent({ [provider + 'OAuth']: 'failed', code }), { provider, guidance });
  }
  assert.deepEqual(readProviderCallbackIntent({ spotifyOAuth: 'failed', code: 'plex_link_restricted_account' }), { provider: 'spotify', guidance: 'review' });
});
test('cleanup removes owned fields without changing unrelated arrays, query or input', () => {
  const query = Object.freeze({ spotifyOAuth: 'failed', youtubeOAuth: 'linked', plexOAuth: 'PRIVATE', code: 'PRIVATE', state: 'PRIVATE', error: 'PRIVATE', error_description: 'PRIVATE', recovery: 'provider', keep: ['a', 'b'] });
  assert.deepEqual(clearProviderCallbackQuery(query), { recovery: 'provider', keep: ['a', 'b'] });
  assert.equal(query.code, 'PRIVATE');
});
test('feedback uses only fixed copy, saved observations and current permission', () => {
  const intent = readProviderCallbackIntent({ spotifyOAuth: 'linked' });
  assert.match(buildProviderCallbackFeedback({ intent, permitted: true, observation: 'absent' }).message, /no saved Spotify link/u);
  assert.match(buildProviderCallbackFeedback({ intent, permitted: true, observation: 'present' }).message, /^Last check found/u);
  assert.match(buildProviderCallbackFeedback({ intent, permitted: false, observation: 'present' }).message, /administrator/u);
  assert.match(buildProviderCallbackFeedback({ intent, permitted: true, observation: 'present', isLoading: true }).message, /^Checking/u);
  assert.match(buildProviderCallbackFeedback({ intent, permitted: true, cleanupFailed: true }).message, /could not be cleared/u);
  const generic = buildProviderCallbackFeedback({ intent: { provider: '__proto__', guidance: 'constructor' }, permitted: true });
  assert.equal(generic.message, 'Provider linking needs review.'); assert.equal(typeof generic.guidance, 'string');
});
