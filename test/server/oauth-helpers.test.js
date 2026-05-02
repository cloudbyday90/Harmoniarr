import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRedirectUri,
  buildTokenMetadata,
  createBase64UrlRandom,
  createCodeChallenge,
  createOAuthError,
  normalizeBaseUrl,
  readJsonResponse,
  resolveRequestBaseUrl,
  safeJsonParse,
  toTokenPayload,
} from '../../src/server/integrations/providers/oauth-helpers.js';

test('createBase64UrlRandom returns base64url-encoded random string of correct length', () => {
  const value = createBase64UrlRandom(32);
  assert.equal(typeof value, 'string');
  assert.equal(value.length, 43);
  assert.match(value, /^[A-Za-z0-9_-]+$/);
});

test('createCodeChallenge produces valid S256 challenge from verifier', () => {
  const verifier = createBase64UrlRandom(64);
  const challenge = createCodeChallenge(verifier);
  assert.equal(typeof challenge, 'string');
  assert.notEqual(challenge, verifier);
  assert.match(challenge, /^[A-Za-z0-9_-]+$/);
});

test('safeJsonParse returns parsed object for valid JSON', () => {
  assert.deepEqual(safeJsonParse('{"key":"value"}'), { key: 'value' });
});

test('safeJsonParse returns null for invalid JSON', () => {
  assert.equal(safeJsonParse('not-json'), null);
  assert.equal(safeJsonParse(null), null);
});

test('toTokenPayload converts token response body to internal payload', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  const payload = toTokenPayload({
    body: {
      access_token: 'access-1',
      expires_in: 3600,
      refresh_token: 'refresh-1',
      scope: 'read write',
      token_type: 'Bearer',
    },
    now,
  });

  assert.equal(payload.accessToken, 'access-1');
  assert.equal(payload.refreshToken, 'refresh-1');
  assert.equal(payload.scope, 'read write');
  assert.equal(payload.tokenType, 'Bearer');
  assert.equal(payload.expiresAt, '2026-05-02T13:00:00.000Z');
});

test('toTokenPayload preserves previous refresh token when body omits it', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');
  const payload = toTokenPayload({
    body: { access_token: 'new-access', expires_in: 3600, token_type: 'Bearer' },
    now,
    previousRefreshToken: 'original-refresh',
  });

  assert.equal(payload.refreshToken, 'original-refresh');
});

test('buildTokenMetadata extracts standard fields from token payload', () => {
  const metadata = buildTokenMetadata(
    { expiresAt: '2026-05-02T13:00:00.000Z', scope: 'read', tokenType: 'Bearer' },
    { linkedAt: '2026-05-02T12:00:00.000Z' },
  );

  assert.equal(metadata.expiresAt, '2026-05-02T13:00:00.000Z');
  assert.equal(metadata.scope, 'read');
  assert.equal(metadata.tokenType, 'Bearer');
  assert.equal(metadata.linkedAt, '2026-05-02T12:00:00.000Z');
});

test('normalizeBaseUrl returns null for empty or non-string input', () => {
  assert.equal(normalizeBaseUrl(''), null);
  assert.equal(normalizeBaseUrl(null), null);
  assert.equal(normalizeBaseUrl(undefined), null);
});

test('normalizeBaseUrl trims trailing slashes', () => {
  assert.equal(normalizeBaseUrl('https://example.com/'), 'https://example.com');
  assert.equal(normalizeBaseUrl('https://example.com/path/'), 'https://example.com/path');
});

test('normalizeBaseUrl strips query and hash', () => {
  assert.equal(normalizeBaseUrl('https://example.com?q=1#hash'), 'https://example.com');
});

test('resolveRequestBaseUrl returns null when no origin in metadata', () => {
  assert.equal(resolveRequestBaseUrl({}), null);
  assert.equal(resolveRequestBaseUrl(), null);
});

test('resolveRequestBaseUrl normalizes origin from metadata', () => {
  assert.equal(resolveRequestBaseUrl({ origin: 'https://example.com' }), 'https://example.com');
});

test('buildRedirectUri constructs callback URL from base and path', () => {
  const uri = buildRedirectUri({
    baseUrlSetting: 'https://example.com',
    callbackPath: '/api/v1/providers/spotify/oauth/callback',
  });
  assert.equal(uri, 'https://example.com/api/v1/providers/spotify/oauth/callback');
});

test('buildRedirectUri falls back to request origin when setting is empty', () => {
  const uri = buildRedirectUri({
    baseUrlSetting: '',
    callbackPath: '/api/v1/callback',
    requestMetadata: { origin: 'https://fallback.example.com' },
  });
  assert.equal(uri, 'https://fallback.example.com/api/v1/callback');
});

test('buildRedirectUri returns null when neither setting nor origin is available', () => {
  const uri = buildRedirectUri({
    baseUrlSetting: '',
    callbackPath: '/api/v1/callback',
  });
  assert.equal(uri, null);
});

test('readJsonResponse parses JSON response body', async () => {
  const response = new Response(JSON.stringify({ key: 'value' }), { status: 200 });
  const body = await readJsonResponse(response);
  assert.deepEqual(body, { key: 'value' });
});

test('readJsonResponse returns empty object for empty body', async () => {
  const response = new Response('', { status: 200 });
  const body = await readJsonResponse(response);
  assert.deepEqual(body, {});
});

test('createOAuthError creates error with code and details', () => {
  const error = createOAuthError('test_error', 'test message', { status: 400 });
  assert.equal(error.message, 'test message');
  assert.equal(error.code, 'test_error');
  assert.deepEqual(error.details, { status: 400 });
});
