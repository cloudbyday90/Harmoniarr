import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthFailureHandler } from '../../src/client/lib/auth-failure-handler.js';

test('createAuthFailureHandler clears session state and redirects to login with a return path', async (t) => {
  const clearSession = t.mock.fn(() => {});
  const push = t.mock.fn(async () => {});
  const handler = createAuthFailureHandler({
    router: {
      currentRoute: {
        value: {
          name: 'settings',
          fullPath: '/app/settings',
        },
      },
      push,
    },
    sessionStore: {
      clearSession,
    },
  });

  await handler();

  assert.equal(clearSession.mock.callCount(), 1);
  assert.equal(push.mock.callCount(), 1);
  assert.deepEqual(push.mock.calls[0].arguments[0], {
    name: 'login',
    query: {
      redirect: '/app/settings',
      reason: 'session-expired',
    },
  });
});

test('createAuthFailureHandler redirects forced re-auth failures with a distinct login reason', async (t) => {
  const clearSession = t.mock.fn(() => {});
  const push = t.mock.fn(async () => {});
  const handler = createAuthFailureHandler({
    router: {
      currentRoute: {
        value: {
          name: 'settings',
          fullPath: '/app/settings',
        },
      },
      push,
    },
    sessionStore: {
      clearSession,
    },
  });

  await handler({ code: 'reauth_required' });

  assert.equal(clearSession.mock.callCount(), 0);
  assert.equal(push.mock.callCount(), 1);
  assert.deepEqual(push.mock.calls[0].arguments[0], {
    name: 'account-security',
    query: {
      redirect: '/app/settings',
    },
  });
});

test('createAuthFailureHandler leaves forced re-auth handling in place when already on account security', async (t) => {
  const clearSession = t.mock.fn(() => {});
  const push = t.mock.fn(async () => {});
  const handler = createAuthFailureHandler({
    router: {
      currentRoute: {
        value: {
          name: 'account-security',
          fullPath: '/app/account-security',
        },
      },
      push,
    },
    sessionStore: {
      clearSession,
    },
  });

  await handler({ code: 'reauth_required' });

  assert.equal(clearSession.mock.callCount(), 0);
  assert.equal(push.mock.callCount(), 0);
});

test('createAuthFailureHandler clears session state without redirecting when already on login', async (t) => {
  const clearSession = t.mock.fn(() => {});
  const push = t.mock.fn(async () => {});
  const handler = createAuthFailureHandler({
    router: {
      currentRoute: {
        value: {
          name: 'login',
          fullPath: '/login',
        },
      },
      push,
    },
    sessionStore: {
      clearSession,
    },
  });

  await handler();

  assert.equal(clearSession.mock.callCount(), 1);
  assert.equal(push.mock.callCount(), 0);
});