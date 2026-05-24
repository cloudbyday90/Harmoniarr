import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createOperatorNotificationAcknowledgementService } from '../../src/server/operator-notification-acknowledgement-service.js';

function makePoolStub(rows = []) {
  return {
    query: async () => ({ rows, rowCount: rows.length }),
  };
}

describe('operator-notification-acknowledgement-service', () => {
  test('getAcknowledgedAt returns null when no timestamp stored', async () => {
    const pool = makePoolStub([{ acknowledged_at: null }]);
    const service = createOperatorNotificationAcknowledgementService({ getPoolFn: () => pool });

    const result = await service.getAcknowledgedAt('user-1');
    assert.equal(result, null);
  });

  test('getAcknowledgedAt returns ISO string when timestamp exists', async () => {
    const pool = makePoolStub([{ acknowledged_at: '2026-05-02T15:00:00.000Z' }]);
    const service = createOperatorNotificationAcknowledgementService({ getPoolFn: () => pool });

    const result = await service.getAcknowledgedAt('user-1');
    assert.equal(result, '2026-05-02T15:00:00.000Z');
  });

  test('getAcknowledgedAt returns null for invalid timestamp', async () => {
    const pool = makePoolStub([{ acknowledged_at: 'not-a-date' }]);
    const service = createOperatorNotificationAcknowledgementService({ getPoolFn: () => pool });

    const result = await service.getAcknowledgedAt('user-1');
    assert.equal(result, null);
  });

  test('getAcknowledgedAt returns null when user not found', async () => {
    const pool = makePoolStub([]);
    const service = createOperatorNotificationAcknowledgementService({ getPoolFn: () => pool });

    const result = await service.getAcknowledgedAt('nonexistent');
    assert.equal(result, null);
  });

  test('setAcknowledgedAt writes timestamp and returns it', async () => {
    const fixedNow = new Date('2026-05-24T12:00:00.000Z');
    let capturedQuery;
    let capturedArgs;
    const pool = {
      query: async (sql, args) => {
        capturedQuery = sql;
        capturedArgs = args;
      },
    };
    const service = createOperatorNotificationAcknowledgementService({
      getPoolFn: () => pool,
      nowFn: () => fixedNow,
    });

    const result = await service.setAcknowledgedAt('user-1');
    assert.equal(result, '2026-05-24T12:00:00.000Z');
    assert.ok(capturedQuery.includes('operatorNotificationsAcknowledgedAt'));
    assert.equal(capturedArgs[0], 'user-1');
  });
});
