import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useAccountSecurity } from '../../src/client/composables/useAccountSecurity.js';

function makeSessionsPayload(overrides = {}) {
  return {
    sessions: [
      { id: 'current-session', isCurrent: true, issuedAt: '2026-05-23T10:00:00.000Z', expiresAt: '2026-06-06T10:00:00.000Z' },
    ],
    ...overrides,
  };
}

function makeActivityPayload(overrides = {}) {
  return {
    events: [
      { id: 'e-1', eventType: 'login_succeeded', summary: 'Login succeeded', occurredAt: '2026-05-23T10:00:00.000Z' },
    ],
    ...overrides,
  };
}

describe('useAccountSecurity SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => makeSessionsPayload(),
      fetchRecentActivityFn: async () => makeActivityPayload(),
    });

    assert.equal(workflow.isRevalidating.value, false);
    await workflow.loadSessions();
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => makeSessionsPayload(),
      fetchRecentActivityFn: async () => makeActivityPayload(),
    });

    await workflow.loadSessions();
    const p = workflow.revalidate();
    assert.equal(workflow.isRevalidating.value, true);
    await p;
    assert.equal(workflow.isRevalidating.value, false);

    workflow.destroy();
  });

  test('revalidate fetches sessions and activity in parallel', async () => {
    let sessionsCalls = 0;
    let activityCalls = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        sessionsCalls += 1;
        return makeSessionsPayload();
      },
      fetchRecentActivityFn: async () => {
        activityCalls += 1;
        return makeActivityPayload();
      },
    });

    await workflow.loadSessions();
    assert.equal(sessionsCalls, 1);
    assert.equal(activityCalls, 0);

    await workflow.revalidate();
    assert.equal(sessionsCalls, 2);
    assert.equal(activityCalls, 1);

    workflow.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        callCount += 1;
        if (callCount === 1) return makeSessionsPayload();
        throw new Error('network fail');
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
    });

    await workflow.loadSessions();
    assert.equal(workflow.sessions.value.length, 1);

    await workflow.revalidate();
    assert.equal(workflow.sessions.value.length, 1, 'stale sessions preserved on error');

    workflow.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let callCount = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        callCount += 1;
        return makeSessionsPayload();
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
    });

    await workflow.loadSessions();
    assert.equal(callCount, 1);
    workflow.destroy();

    await workflow.revalidate();
    assert.equal(callCount, 1);
  });

  test('pollIntervalMs schedules recurring revalidations', async () => {
    let sessionsCalls = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        sessionsCalls += 1;
        return makeSessionsPayload();
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
      pollIntervalMs: 30,
    });

    await workflow.loadSessions();
    assert.equal(sessionsCalls, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(sessionsCalls >= 2, 'polling triggered additional fetches');

    workflow.destroy();
  });

  test('destroy stops polling', async () => {
    let sessionsCalls = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        sessionsCalls += 1;
        return makeSessionsPayload();
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
      pollIntervalMs: 30,
    });

    await workflow.loadSessions();
    workflow.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(sessionsCalls, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let sessionsCalls = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        sessionsCalls += 1;
        return makeSessionsPayload();
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
      pollIntervalMs: 0,
    });

    await workflow.loadSessions();
    assert.equal(sessionsCalls, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(sessionsCalls, 1);

    workflow.destroy();
  });

  test('revokeSession triggers background revalidation', async () => {
    let sessionsCalls = 0;
    const workflow = useAccountSecurity({
      fetchActiveSessionsFn: async () => {
        sessionsCalls += 1;
        return makeSessionsPayload({
          sessions: sessionsCalls === 1
            ? [{ id: 'current-session', isCurrent: true }, { id: 'other-session', isCurrent: false }]
            : [{ id: 'current-session', isCurrent: true }],
        });
      },
      fetchRecentActivityFn: async () => makeActivityPayload(),
      revokeSessionFn: async () => ({}),
    });

    await workflow.loadSessions();
    assert.equal(sessionsCalls, 1);
    assert.equal(workflow.sessions.value.length, 2);

    await workflow.revokeSession('other-session');
    assert.equal(workflow.successMessage.value, 'Session revoked.');

    await new Promise((resolve) => { setTimeout(resolve, 10); });
    assert.ok(sessionsCalls >= 2, 'revalidation triggered after revoke');

    workflow.destroy();
  });
});
