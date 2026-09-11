/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useProviderCollectionAccessCheck } from '../../src/client/composables/useProviderCollectionAccessCheck.js';
import { buildProviderCollectionAccessSummary } from '../../src/client/lib/provider-collection-access-presentation.js';

function createCheck(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: 'spotify',
    resourceType: 'playlist',
    authMode: 'oauth_user',
    quotaMode: 'unknown',
    outcome: 'verified',
    code: 'access_verified',
    pagesChecked: 2,
    entriesSeen: 100,
    hasMore: true,
    fullTraversal: false,
    multiPageObserved: true,
    snapshotCheck: 'verified',
    checkedAt: '2026-09-11T12:00:00Z',
    retryAfterSeconds: null,
    label: 'Collection pages verified',
    detail: 'The returned pages were readable with saved authorization.',
    nextAction: 'Continue with collection review for this source.',
    ...overrides,
  };
}

test('collection access is explicit, prevents duplicate submissions, and projects only bounded result fields', async (t) => {
  let resolveCheck;
  const pending = new Promise((resolve) => { resolveCheck = resolve; });
  const checkAccess = t.mock.fn(() => pending);
  const state = useProviderCollectionAccessCheck({ checkAccess });
  assert.equal(checkAccess.mock.callCount(), 0);
  state.sourceUrl.value = '  https://open.spotify.com/playlist/fixture  ';
  const first = state.runCheck();
  assert.equal(state.isChecking.value, true);
  assert.equal(await state.runCheck(), null);
  assert.equal(checkAccess.mock.callCount(), 1);
  assert.ok(checkAccess.mock.calls[0].arguments[0].sourceUrl === state.sourceUrl.value.trim());
  resolveCheck({ ok: true, check: createCheck({ rawBody: 'private-response', sourceUrl: 'private-source', accessToken: 'private-token' }) });
  await first;
  assert.equal(state.isChecking.value, false);
  assert.equal(state.errorMessage.value, '');
  assert.equal(state.result.value.authModeLabel, 'Linked user authorization');
  assert.equal(state.result.value.pagesChecked, 2);
  assert.match(state.result.value.coverageLabel, /full collection was not checked/i);
  assert.equal(state.result.value.multiPageLabel, 'Observed across multiple pages');
  assert.ok(!/private-/.test(JSON.stringify(state.result.value)), 'Private provider fields are excluded from result state.');
});

test('changing the source cancels its pending check and prevents an old result from replacing a newer result', async () => {
  const pending = [];
  const state = useProviderCollectionAccessCheck({
    checkAccess: (body, { signal }) => new Promise((resolve) => { pending.push({ resolve, signal }); }),
  });
  state.sourceUrl.value = 'https://open.spotify.com/playlist/first';
  const first = state.runCheck();
  state.sourceUrl.value = 'https://open.spotify.com/playlist/second';
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(state.isChecking.value, false);
  const second = state.runCheck();
  pending[1].resolve({ ok: true, check: createCheck({ label: 'Second source checked' }) });
  await second;
  pending[0].resolve({ ok: true, check: createCheck({ label: 'Old source checked' }) });
  await first;
  assert.equal(state.result.value.label, 'Second source checked');
  state.sourceUrl.value = 'https://open.spotify.com/playlist/third';
  assert.equal(state.result.value, null);
});

test('leaving the view aborts an in-progress check without publishing its late error', async () => {
  let rejectCheck;
  let signal;
  const scope = effectScope();
  const state = scope.run(() => useProviderCollectionAccessCheck({
    checkAccess: (body, options) => new Promise((resolve, reject) => {
      signal = options.signal;
      rejectCheck = reject;
    }),
  }));
  state.sourceUrl.value = 'https://open.spotify.com/playlist/fixture';
  const pending = state.runCheck();
  scope.stop();
  assert.equal(signal.aborted, true);
  rejectCheck(new Error('private-provider-failure'));
  await pending;
  assert.equal(state.errorMessage.value, '');
  assert.equal(state.result.value, null);
});

test('validation, rate limit, session, and unexpected failures preserve the input and expose fixed recovery messages', async () => {
  for (const [status, code, expected] of [
    [400, 'validation_error', /supported Spotify or Apple Music/],
    [429, 'rate_limit_exceeded', /Wait a minute/],
    [401, 'auth_required', /Sign in again/],
    [403, 'reauth_required', /Sign in again/],
    [403, 'csrf_invalid', /Refresh this page/],
    [500, 'internal_error', /saved connection settings/],
  ]) {
    const state = useProviderCollectionAccessCheck({
      checkAccess: async () => { throw Object.assign(new Error('private-provider-token-and-response'), { status, code }); },
    });
    const sourceUrl = 'https://open.spotify.com/playlist/fixture';
    state.sourceUrl.value = sourceUrl;
    await state.runCheck();
    assert.ok(state.sourceUrl.value === sourceUrl, 'Failure preserves the input for correction or retry.');
    assert.match(state.errorMessage.value, expected);
    assert.equal(state.isInputInvalid.value, status === 400);
    assert.ok(!state.errorMessage.value.includes('private-provider'), 'Raw errors remain private.');
    assert.equal(state.result.value, null);
  }
});

test('empty input and malformed responses never show a successful access check', async (t) => {
  const checkAccess = t.mock.fn(async () => ({ ok: true, check: { outcome: 'verified' } }));
  const state = useProviderCollectionAccessCheck({ checkAccess });
  await state.runCheck();
  assert.equal(checkAccess.mock.callCount(), 0);
  assert.match(state.errorMessage.value, /Enter a playlist or artist URL/);
  assert.equal(state.isInputInvalid.value, true);
  state.sourceUrl.value = 'https://open.spotify.com/playlist/fixture';
  assert.equal(state.isInputInvalid.value, false);
  await state.runCheck();
  assert.equal(checkAccess.mock.callCount(), 1);
  assert.equal(state.result.value, null);
  assert.match(state.errorMessage.value, /could not be checked/);
});

test('coverage distinguishes complete source traversal, partial checks, failed snapshots, and unknown quota', () => {
  const complete = buildProviderCollectionAccessSummary(createCheck({ fullTraversal: true, hasMore: false }));
  assert.equal(complete.coverageLabel, 'All collection pages checked for this source.');
  assert.equal(complete.quotaLabel, 'Provider quota mode is unknown');

  const failed = buildProviderCollectionAccessSummary(createCheck({
    outcome: 'failed', fullTraversal: true, hasMore: false, snapshotCheck: 'failed', retryAfterSeconds: 35,
  }));
  assert.equal(failed.coverageLabel, 'Collection access remains unverified.');
  assert.equal(failed.snapshotLabel, 'Collection changed during the check');
  assert.equal(failed.retryLabel, 'Wait at least 35 seconds before checking again.');
  assert.equal(failed.tone, 'danger');

  const notChecked = buildProviderCollectionAccessSummary(createCheck({ outcome: 'not_checked', pagesChecked: 0, entriesSeen: 0, authMode: 'none', multiPageObserved: false }));
  assert.equal(notChecked.authModeLabel, 'No saved authorization available');
  assert.equal(notChecked.multiPageLabel, 'Not demonstrated');
  assert.equal(notChecked.tone, 'warning');
  assert.equal(buildProviderCollectionAccessSummary(createCheck({ pagesChecked: 3 })), null);
  assert.equal(buildProviderCollectionAccessSummary(createCheck({ entriesSeen: 201 })), null);
  assert.equal(buildProviderCollectionAccessSummary(createCheck({ authMode: 'unexpected' })), null);
});
