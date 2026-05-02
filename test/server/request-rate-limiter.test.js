import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestRateLimiterService } from '../../src/server/request-rate-limiter.js';

test('createRequestRateLimiterService denies requests after the configured limit and reports abuse metadata', () => {
  let currentTime = 0;
  const onLimitCalls = [];
  const service = createRequestRateLimiterService({
    now: () => currentTime,
    onLimit: (event) => {
      onLimitCalls.push(event);
    },
  });
  const middleware = service.createMiddleware({
    bucketName: 'auth-login',
    limit: 2,
    windowMs: 1000,
  });

  const request = {
    headers: {
      'x-forwarded-for': '203.0.113.10',
    },
    method: 'POST',
    url: '/api/v1/auth/login',
  };
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  const firstCalls = [];
  middleware(request, response, (error) => {
    firstCalls.push(error ?? null);
  });
  middleware(request, response, (error) => {
    firstCalls.push(error ?? null);
  });
  middleware(request, response, (error) => {
    firstCalls.push(error ?? null);
  });

  assert.deepEqual(firstCalls.slice(0, 2), [null, null]);
  assert.equal(firstCalls[2].status, 429);
  assert.equal(firstCalls[2].code, 'rate_limited');
  assert.equal(response.headers['Retry-After'], '1');
  assert.equal(onLimitCalls.length, 1);
  assert.equal(onLimitCalls[0].bucketName, 'auth-login');
  assert.equal(onLimitCalls[0].key, '203.0.113.10');

  currentTime = 1001;
  const postWindowCalls = [];
  middleware(request, response, (error) => {
    postWindowCalls.push(error ?? null);
  });

  assert.deepEqual(postWindowCalls, [null]);
});