import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestRateLimiterService, skipRateLimitMiddleware } from '../../src/server/request-rate-limiter.js';

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

test('skipRateLimitMiddleware calls next without error', () => {
  const calls = [];
  skipRateLimitMiddleware({}, {}, (error) => {
    calls.push(error ?? null);
  });
  assert.deepEqual(calls, [null]);
});

test('createMiddleware uses socket remoteAddress when x-forwarded-for is absent', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({
    bucketName: 'test-bucket',
    limit: 1,
    windowMs: 1000,
  });

  const request = {
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
  };
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  const calls = [];
  middleware(request, response, (error) => {
    calls.push(error ?? null);
  });
  assert.deepEqual(calls, [null]);
  assert.equal(response.headers['RateLimit-Limit'], '1');
  assert.equal(response.headers['RateLimit-Remaining'], '0');
});

test('createMiddleware uses unknown key when socket is absent', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({
    bucketName: 'test-bucket',
    limit: 1,
    windowMs: 1000,
  });

  const request = { headers: {} };
  const response = {
    headers: {},
    setHeader() {},
  };

  const calls = [];
  middleware(request, response, (error) => {
    calls.push(error ?? null);
  });
  assert.deepEqual(calls, [null]);
});

test('createMiddleware throws when bucketName is missing', () => {
  const service = createRequestRateLimiterService();
  assert.throws(() => service.createMiddleware({ limit: 5, windowMs: 1000 }), {
    message: 'bucketName is required',
  });
});

test('createMiddleware throws when limit is not a positive integer', () => {
  const service = createRequestRateLimiterService();
  assert.throws(
    () => service.createMiddleware({ bucketName: 'x', limit: 0, windowMs: 1000 }),
    { message: 'limit must be a positive integer' },
  );
  assert.throws(
    () => service.createMiddleware({ bucketName: 'x', limit: 1.5, windowMs: 1000 }),
    { message: 'limit must be a positive integer' },
  );
});

test('createMiddleware throws when windowMs is less than 1000', () => {
  const service = createRequestRateLimiterService();
  assert.throws(
    () => service.createMiddleware({ bucketName: 'x', limit: 5, windowMs: 500 }),
    { message: 'windowMs must be an integer greater than or equal to 1000' },
  );
});

test('buckets are isolated by name — different bucketNames have independent counters', () => {
  const service = createRequestRateLimiterService();
  const mw1 = service.createMiddleware({ bucketName: 'bucket-a', limit: 1, windowMs: 60000 });
  const mw2 = service.createMiddleware({ bucketName: 'bucket-b', limit: 1, windowMs: 60000 });

  const request = {
    headers: { 'x-forwarded-for': '10.0.0.1' },
    socket: {},
  };
  const response = { headers: {}, setHeader() {} };

  const calls1 = [];
  mw1(request, response, (e) => calls1.push(e ?? null));
  mw1(request, response, (e) => calls1.push(e ?? null));

  const calls2 = [];
  mw2(request, response, (e) => calls2.push(e ?? null));

  assert.equal(calls1[0], null);
  assert.equal(calls1[1].status, 429);
  assert.equal(calls2[0], null);
});

test('different IPs get independent rate limit counters within the same bucket', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({ bucketName: 'shared', limit: 1, windowMs: 60000 });

  const response = { headers: {}, setHeader() {} };

  const requestA = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} };
  const requestB = { headers: { 'x-forwarded-for': '10.0.0.2' }, socket: {} };

  const callsA = [];
  middleware(requestA, response, (e) => callsA.push(e ?? null));
  middleware(requestA, response, (e) => callsA.push(e ?? null));

  const callsB = [];
  middleware(requestB, response, (e) => callsB.push(e ?? null));

  assert.equal(callsA[0], null);
  assert.equal(callsA[1].status, 429);
  assert.equal(callsB[0], null);
});

test('x-forwarded-for uses only the first IP in the comma-separated list', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({ bucketName: 'forwarded', limit: 1, windowMs: 60000 });

  const response = { headers: {}, setHeader() {} };
  const request1 = { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, socket: {} };
  const request2 = { headers: { 'x-forwarded-for': '1.1.1.1, 3.3.3.3' }, socket: {} };

  const calls = [];
  middleware(request1, response, (e) => calls.push(e ?? null));
  middleware(request2, response, (e) => calls.push(e ?? null));

  assert.equal(calls[0], null);
  assert.equal(calls[1].status, 429);
});

test('rate limit headers are set on both allowed and rejected requests', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({ bucketName: 'headers-test', limit: 2, windowMs: 10000 });

  const request = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} };

  const res1 = { headers: {}, setHeader(n, v) { this.headers[n] = v; } };
  middleware(request, res1, () => {});
  assert.equal(res1.headers['RateLimit-Limit'], '2');
  assert.equal(res1.headers['RateLimit-Remaining'], '1');
  assert.equal(res1.headers['RateLimit-Reset'], '10');
  assert.equal(res1.headers['Retry-After'], undefined);

  const res2 = { headers: {}, setHeader(n, v) { this.headers[n] = v; } };
  middleware(request, res2, () => {});
  assert.equal(res2.headers['RateLimit-Remaining'], '0');

  const res3 = { headers: {}, setHeader(n, v) { this.headers[n] = v; } };
  middleware(request, res3, () => {});
  assert.equal(res3.headers['Retry-After'], '10');
});

test('custom keyFn overrides the default IP-based key', () => {
  const service = createRequestRateLimiterService();
  const middleware = service.createMiddleware({
    bucketName: 'custom-key',
    keyFn: (req) => req.body?.userId ?? 'anonymous',
    limit: 1,
    windowMs: 60000,
  });

  const response = { headers: {}, setHeader() {} };

  const reqUser1 = { headers: {}, body: { userId: 'alice' } };
  const reqUser2 = { headers: {}, body: { userId: 'bob' } };

  const calls1 = [];
  middleware(reqUser1, response, (e) => calls1.push(e ?? null));
  middleware(reqUser1, response, (e) => calls1.push(e ?? null));

  const calls2 = [];
  middleware(reqUser2, response, (e) => calls2.push(e ?? null));

  assert.equal(calls1[0], null);
  assert.equal(calls1[1].status, 429);
  assert.equal(calls2[0], null);
});