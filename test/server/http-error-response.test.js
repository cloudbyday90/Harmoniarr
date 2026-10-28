/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError, getPublicApiError } from '../../src/server/api-error.js';
import { buildHttpErrorResponse, createHttpErrorHandler } from '../../src/server/http-error-response.js';

const generic = { status: 500, body: { ok: false, error: { code: 'internal_error', message: 'Unexpected server error' } } };
const expected = (status, code, message) => ({ status, body: { ok: false, error: { code, message } } });

test('API errors capture immutable public intent while preserving internal Error fields', () => {
  const error = createApiError(400, 'validation_error', 'name is required');
  assert.ok(error instanceof Error); assert.equal(error.status, 400); assert.equal(error.message, 'name is required');
  const descriptor = getPublicApiError(error); assert.equal(Object.isFrozen(descriptor), true);
  Object.assign(error, { status: 200, code: 'PRIVATE-code', message: 'PRIVATE-secret', cause: new Error('PRIVATE-cause') });
  assert.deepEqual(buildHttpErrorResponse(error), expected(400, 'validation_error', 'name is required'));
  assert.equal(error.message, 'PRIVATE-secret'); assert.equal(error.cause.message, 'PRIVATE-cause');
  for (const copy of [{ ...error }, Object.create(error), new Error(error.message), Object.assign(new Error('PRIVATE'), { status: 400, code: 'validation_error', expose: true })]) {
    assert.equal(getPublicApiError(copy), null); assert.deepEqual(buildHttpErrorResponse(copy), generic);
  }
});

test('intentional application status and code contracts survive without extra properties', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 599]) {
    const error = Object.assign(createApiError(status, 'test_failure', 'A bounded public explanation'), { headers: { 'X-Secret': 'PRIVATE' }, details: 'PRIVATE', query: 'PRIVATE' });
    assert.deepEqual(buildHttpErrorResponse(error), expected(status, 'test_failure', 'A bounded public explanation'));
  }
});

test('invalid public definitions fail closed while exact field bounds remain accepted', () => {
  for (const args of [[200, 'failure', 'PRIVATE'], [399, 'failure', 'PRIVATE'], [600, 'failure', 'PRIVATE'], [400.5, 'failure', 'PRIVATE'], ['400', 'failure', 'PRIVATE'], [400, '', 'PRIVATE'], [400, 'x'.repeat(129), 'PRIVATE'], [400, 'failure', ''], [400, 'failure', 'PRIVATE'.repeat(400)], [400, null, 'PRIVATE'], [400, 'failure', undefined]]) {
    assert.deepEqual(buildHttpErrorResponse(createApiError(...args)), generic);
  }
  assert.deepEqual(buildHttpErrorResponse(createApiError(400, 'x'.repeat(128), 'a'.repeat(2048))), expected(400, 'x'.repeat(128), 'a'.repeat(2048)));
});

test('unknown SQL, filesystem, provider and status-bearing errors have a fixed representation', () => {
  for (const error of [new Error('PRIVATE SQL SELECT password FROM users'), Object.assign(new Error('PRIVATE /data/secrets/key.pem'), { code: 'ENOENT', path: '/PRIVATE' }), Object.assign(new Error('PRIVATE-provider-response'), { status: 502, code: 'provider_failed', expose: true }), { status: 404, statusCode: 404, code: 'not_found', message: 'PRIVATE' }, new SyntaxError('PRIVATE request body')]) {
    assert.deepEqual(buildHttpErrorResponse(error), generic);
  }
});

test('primitive rejections and hostile getters cannot break error projection or run custom serialization', () => {
  for (const value of [null, undefined, false, 0, NaN, 1n, Symbol('PRIVATE'), 'PRIVATE']) assert.deepEqual(buildHttpErrorResponse(value), generic);
  let serialized = false;
  const hostile = new Proxy({}, { get() { throw new Error('PRIVATE-getter'); } });
  assert.deepEqual(buildHttpErrorResponse(hostile), generic);
  const error = Object.assign(createApiError(409, 'conflict', 'Already exists'), { toJSON() { serialized = true; throw new Error('PRIVATE-toJSON'); } });
  Object.defineProperty(error, 'cause', { get() { throw new Error('PRIVATE-cause'); } });
  assert.equal(JSON.stringify(buildHttpErrorResponse(error)), JSON.stringify(expected(409, 'conflict', 'Already exists')));
  assert.equal(serialized, false);
});

test('recognized parser and native database failures keep static bounded contracts', () => {
  for (const [type, status, code, message] of [['entity.parse.failed', 400, 'invalid_json', 'Request body must contain valid JSON'], ['entity.too.large', 413, 'payload_too_large', 'Request body exceeds the supported size limit']]) {
    assert.deepEqual(buildHttpErrorResponse(Object.assign(new Error('PRIVATE body'), { type, body: 'PRIVATE', status: 999 })), expected(status, code, message));
  }
  for (const code of ['ECONNREFUSED', 'ECONNRESET', '57P01', '08006', 'database_pool_busy']) {
    assert.deepEqual(buildHttpErrorResponse(Object.assign(new Error('PRIVATE database'), { code })), expected(503, 'database_unavailable', 'Database is temporarily unavailable'));
  }
  assert.deepEqual(buildHttpErrorResponse(new Error('timeout exceeded when trying to connect')), expected(503, 'database_unavailable', 'Database is temporarily unavailable'));
});

test('middleware sends only the projection and overrides error-controlled cache and response headers', () => {
  const calls = [], response = { headersSent: false, setHeader: (...args) => calls.push(['header', ...args]), status(status) { calls.push(['status', status]); return this; }, json(body) { calls.push(['body', body]); return 'sent'; } };
  const error = Object.assign(new Error('PRIVATE'), { status: 200, headers: { 'Set-Cookie': 'PRIVATE' }, toJSON() { throw new Error('PRIVATE'); } });
  const handler = createHttpErrorHandler(); assert.equal(handler.length, 4);
  assert.equal(handler(error, {}, response, () => assert.fail('Unexpected delegation')), 'sent');
  assert.deepEqual(calls, [['header', 'Cache-Control', 'no-store'], ['status', 500], ['body', generic.body]]);
});

test('already-started responses delegate only a bounded Error without a second write', () => {
  const original = Object.assign(new Error('PRIVATE SQL and key'), { cause: 'PRIVATE', status: 200, headers: { 'X-Secret': 'PRIVATE' } });
  const response = { headersSent: true, setHeader() { assert.fail('Second header'); }, status() { assert.fail('Second status'); }, json() { assert.fail('Second body'); } };
  let delegated;
  createHttpErrorHandler()(original, {}, response, error => { delegated = error; });
  assert.ok(delegated instanceof Error); assert.notEqual(delegated, original);
  assert.equal(delegated.message, 'Unexpected server error'); assert.equal(delegated.status, 500); assert.equal(delegated.code, 'internal_error');
  assert.equal(delegated.cause, undefined); assert.equal(delegated.headers, undefined); assert.ok(!delegated.stack.includes('PRIVATE'));
});
