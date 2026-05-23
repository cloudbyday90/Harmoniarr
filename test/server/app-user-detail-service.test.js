import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppUserDetailService } from '../../src/server/app-user-detail-service.js';

test('getUserRequestSummary returns aggregated counts', async (t) => {
  let callIndex = 0;
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return { rows: [{ request_state: 'needs_fetch', count: 3 }, { request_state: 'cancelled', count: 1 }] };
      }
      return { rows: [{ request_state: 'needs_review', count: 2 }] };
    }),
  }));
  const service = createAppUserDetailService({ getPoolFn });

  const summary = await service.getUserRequestSummary({ userId: 'user-1' });

  assert.equal(summary.total, 6);
  assert.equal(summary.asRequester.needsFetch, 3);
  assert.equal(summary.asRequester.cancelled, 1);
  assert.equal(summary.asTarget.needsReview, 2);
  assert.equal(summary.asTarget.needsFetch, 0);
});

test('getUserSessions maps refresh token rows', async (t) => {
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => ({
      rows: [{
        id: 'rt-1',
        issued_at: '2026-05-20T10:00:00Z',
        issued_ip: '192.168.1.1',
        issued_user_agent: 'Mozilla/5.0',
        last_used_at: '2026-05-21T10:00:00Z',
        expires_at: '2026-06-20T10:00:00Z',
        is_revoked: false,
      }],
    })),
  }));
  const service = createAppUserDetailService({ getPoolFn });

  const sessions = await service.getUserSessions({ userId: 'user-1' });

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, 'rt-1');
  assert.equal(sessions[0].issuedIp, '192.168.1.1');
  assert.equal(sessions[0].isRevoked, false);
});

test('listUserAuditEvents returns events with cursor pagination', async (t) => {
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => ({
      rows: [{
        id: 'ae-1',
        occurred_at: '2026-05-21T12:00:00Z',
        event_type: 'user_login',
        entity_type: 'app_user',
        entity_id: 'user-1',
        summary: 'User logged in',
        details: { ip: '10.0.0.1' },
      }],
    })),
  }));
  const service = createAppUserDetailService({ getPoolFn });

  const result = await service.listUserAuditEvents({ userId: 'user-1', limit: 25 });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventType, 'user_login');
  assert.equal(result.events[0].summary, 'User logged in');
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, null);
});

test('listUserAuditEvents returns hasMore and nextCursor when extra rows exist', async (t) => {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    rows.push({
      id: `ae-${i}`,
      occurred_at: new Date(Date.now() - i * 60000).toISOString(),
      event_type: 'user_action',
      entity_type: null,
      entity_id: null,
      summary: `Event ${i}`,
      details: null,
    });
  }
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => ({ rows })),
  }));
  const service = createAppUserDetailService({ getPoolFn });

  const result = await service.listUserAuditEvents({ userId: 'user-1', limit: 2 });

  assert.equal(result.events.length, 2);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);
});

test('listUserAuditEvents decodes cursor for subsequent pages', async (t) => {
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => ({ rows: [] })),
  }));
  const service = createAppUserDetailService({ getPoolFn });

  const cursor = Buffer.from(JSON.stringify({ o: '2026-05-21T12:00:00Z', i: 'ae-5' })).toString('base64url');
  await service.listUserAuditEvents({ userId: 'user-1', cursor, limit: 10 });

  assert.equal(getPoolFn.mock.calls.length, 1);
});
