/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/api-error.js';
import { buildHttpErrorResponse } from '../../src/server/http-error-response.js';
import { normalizeMusicBrainzRouteError, normalizeSlskdRouteError } from '../../src/server/integrations/providers/provider-route-error-policy.js';

const cases = [
  [normalizeMusicBrainzRouteError, 'musicbrainz_not_found', 404, 'MusicBrainz resource was not found'],
  [normalizeMusicBrainzRouteError, 'musicbrainz_misconfigured', 503, 'MusicBrainz configuration needs review'],
  [normalizeMusicBrainzRouteError, 'musicbrainz_unavailable', 503, 'MusicBrainz is temporarily unavailable'],
  [normalizeMusicBrainzRouteError, 'musicbrainz_request_failed', 502, 'MusicBrainz request failed. Review the request and try again.'],
  [normalizeMusicBrainzRouteError, 'musicbrainz_invalid_response', 502, 'MusicBrainz returned an invalid response'],
  [normalizeSlskdRouteError, 'slskd_misconfigured', 503, 'Soulseek connection settings need review'],
  [normalizeSlskdRouteError, 'slskd_unauthorized', 503, 'Soulseek authentication failed'],
  [normalizeSlskdRouteError, 'slskd_unavailable', 503, 'Soulseek is temporarily unavailable'],
  [normalizeSlskdRouteError, 'slskd_request_failed', 502, 'Soulseek request failed. Try again.'],
];
for (const [normalize, code, status, message] of cases) {
  test(`route policy maps ${code} without private diagnostics or error-controlled status`, () => {
    const original = Object.freeze(Object.assign(new Error('PRIVATE /data/key.pem upstream response'), { code, status: 200, cause: 'PRIVATE', details: 'PRIVATE', headers: { 'X-Secret': 'PRIVATE' } }));
    const mapped = normalize(original);
    assert.deepEqual(buildHttpErrorResponse(mapped), { status, body: { ok: false, error: { code, message } } });
    assert.notEqual(mapped, original); assert.equal(mapped.cause, undefined); assert.equal(mapped.details, undefined); assert.equal(mapped.headers, undefined);
    assert.equal(original.status, 200); assert.equal(original.message, 'PRIVATE /data/key.pem upstream response');
  });
}
test('known public provider errors still receive catalog text using captured code', () => {
  const error = createApiError(500, 'slskd_request_failed', 'PRIVATE');
  Object.assign(error, { code: 'unknown', message: 'PRIVATE-mutated', status: 200 });
  const mapped = normalizeSlskdRouteError(error);
  assert.equal(mapped.status, 502); assert.equal(mapped.code, 'slskd_request_failed'); assert.equal(mapped.message, 'Soulseek request failed. Try again.');
  assert.equal(error.message, 'PRIVATE-mutated');
});
test('local application errors retain identity and captured text despite mutable code impersonation', () => {
  const error = createApiError(400, 'validation_error', 'view must be full or summary');
  error.code = 'musicbrainz_request_failed'; error.message = 'PRIVATE';
  assert.equal(normalizeMusicBrainzRouteError(error), error);
  assert.deepEqual(buildHttpErrorResponse(error), { status: 400, body: { ok: false, error: { code: 'validation_error', message: 'view must be full or summary' } } });
});
test('unowned local lookalikes are not promoted to public errors', () => {
  for (const code of ['validation_error', 'metadata_not_found', 'app_user_not_found']) {
    const error = Object.assign(new Error('PRIVATE'), { code, status: 400, expose: true });
    assert.equal(normalizeMusicBrainzRouteError(error), error);
    assert.deepEqual(buildHttpErrorResponse(error), { status: 500, body: { ok: false, error: { code: 'internal_error', message: 'Unexpected server error' } } });
  }
});
test('unknown, cross-provider and prototype-like codes retain identity without coercion', () => {
  const coercion = { toString() { assert.fail('Code coercion'); } };
  const codeCases = [[normalizeSlskdRouteError, 'musicbrainz_request_failed'], [normalizeMusicBrainzRouteError, 'slskd_request_failed'],
    ...['__proto__', 'constructor', 'toString', coercion, Symbol('PRIVATE')].map(candidateCode => [normalizeSlskdRouteError, candidateCode])];
  for (const [normalize, code] of codeCases) {
    const error = { code, message: 'PRIVATE' }; assert.equal(normalize(error), error);
  }
  for (const error of [null, undefined, false, 0, NaN, 1n, 'PRIVATE']) assert.ok(Object.is(normalizeSlskdRouteError(error), error));
});
test('normalization never reads private message, cause or serialization and handles a throwing code getter', () => {
  const error = { code: 'musicbrainz_request_failed', get message() { return assert.fail('Private message read'); }, get cause() { return assert.fail('Private cause read'); }, toJSON() { assert.fail('Private serialization'); } };
  assert.equal(normalizeMusicBrainzRouteError(error).status, 502);
  const hostile = new Proxy({}, { get() { throw new Error('PRIVATE'); } });
  assert.equal(normalizeSlskdRouteError(hostile), hostile); assert.equal(buildHttpErrorResponse(hostile).status, 500);
});
test('native database failures keep identity for existing bounded global handling', () => {
  const error = Object.assign(new Error('PRIVATE database'), { code: 'ECONNRESET' });
  assert.equal(normalizeMusicBrainzRouteError(error), error); assert.equal(normalizeSlskdRouteError(error), error);
  assert.deepEqual(buildHttpErrorResponse(error), { status: 503, body: { ok: false, error: { code: 'database_unavailable', message: 'Database is temporarily unavailable' } } });
});
