/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdWebhookIngestionService } from '../../src/server/integrations/slskd/slskd-webhook-ingestion-service.js';

function createPassthroughIdempotency(t) {
  const records = new Map();
  return {
    records,
    executeIdempotentMutation: t.mock.fn(async ({ executeMutation, idempotencyKey, requestPayload }) => {
      if (records.has(idempotencyKey)) {
        const existing = records.get(idempotencyKey);
        return { body: existing.body, replayed: true, statusCode: existing.statusCode };
      }
      const result = await executeMutation();
      records.set(idempotencyKey, { body: result.body, requestPayload, statusCode: result.statusCode });
      return { body: result.body, replayed: false, statusCode: result.statusCode };
    }),
  };
}

const actionableEvent = {
  id: 'evt-1',
  type: 'DownloadFileComplete',
  timestamp: '2026-06-26T12:00:00.000Z',
};

test('ingestWebhookEvent rejects requests when no secret is configured', async (t) => {
  const service = createSlskdWebhookIngestionService({
    getWebhookSecret: () => null,
    nudgeReconciliationFn: t.mock.fn(async () => {}),
  });
  await assert.rejects(
    () => service.ingestWebhookEvent({ providedSecret: 'anything', rawPayload: actionableEvent }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'slskd_webhook_not_configured');
      return true;
    },
  );
});

test('ingestWebhookEvent rejects an invalid secret without nudging', async (t) => {
  const nudgeReconciliationFn = t.mock.fn(async () => {});
  const service = createSlskdWebhookIngestionService({
    getWebhookSecret: () => 'correct-horse-battery-staple',
    nudgeReconciliationFn,
  });
  await assert.rejects(
    () => service.ingestWebhookEvent({ providedSecret: 'wrong', rawPayload: actionableEvent }),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'slskd_webhook_unauthorized');
      return true;
    },
  );
  assert.equal(nudgeReconciliationFn.mock.callCount(), 0);
});

test('ingestWebhookEvent accepts a valid event and nudges reconciliation', async (t) => {
  const nudgeReconciliationFn = t.mock.fn(async () => {});
  const idempotency = createPassthroughIdempotency(t);
  const service = createSlskdWebhookIngestionService({
    executeIdempotentMutation: idempotency.executeIdempotentMutation,
    getNow: () => new Date('2026-06-26T12:00:05.000Z'),
    getWebhookSecret: () => 'shared-secret',
    nudgeReconciliationFn,
  });

  const result = await service.ingestWebhookEvent({ providedSecret: 'shared-secret', rawPayload: actionableEvent });

  assert.equal(result.accepted, true);
  assert.equal(result.actionable, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.eventType, 'download_file_complete');

  // The nudge is fire-and-forget; allow the microtask to run.
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(nudgeReconciliationFn.mock.callCount(), 1);
});

test('ingestWebhookEvent deduplicates repeated event ids without re-nudging', async (t) => {
  const nudgeReconciliationFn = t.mock.fn(async () => {});
  const idempotency = createPassthroughIdempotency(t);
  const service = createSlskdWebhookIngestionService({
    executeIdempotentMutation: idempotency.executeIdempotentMutation,
    getNow: () => new Date('2026-06-26T12:00:05.000Z'),
    getWebhookSecret: () => 'shared-secret',
    nudgeReconciliationFn,
  });

  await service.ingestWebhookEvent({ providedSecret: 'shared-secret', rawPayload: actionableEvent });
  const second = await service.ingestWebhookEvent({ providedSecret: 'shared-secret', rawPayload: actionableEvent });

  assert.equal(second.deduplicated, true);
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(nudgeReconciliationFn.mock.callCount(), 1);
});

test('ingestWebhookEvent acknowledges non-actionable events without nudging', async (t) => {
  const nudgeReconciliationFn = t.mock.fn(async () => {});
  const idempotency = createPassthroughIdempotency(t);
  const service = createSlskdWebhookIngestionService({
    executeIdempotentMutation: idempotency.executeIdempotentMutation,
    getNow: () => new Date('2026-06-26T12:00:05.000Z'),
    getWebhookSecret: () => 'shared-secret',
    nudgeReconciliationFn,
  });

  const result = await service.ingestWebhookEvent({
    providedSecret: 'shared-secret',
    rawPayload: { id: 'evt-upload', type: 'UploadFileComplete' },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.actionable, false);
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(nudgeReconciliationFn.mock.callCount(), 0);
});

test('ingestWebhookEvent does not let a failing nudge reject the webhook response', async (t) => {
  const nudgeReconciliationFn = t.mock.fn(async () => {
    throw new Error('reconciliation exploded');
  });
  const service = createSlskdWebhookIngestionService({
    getNow: () => new Date('2026-06-26T12:00:05.000Z'),
    getWebhookSecret: () => 'shared-secret',
    nudgeReconciliationFn,
  });

  const result = await service.ingestWebhookEvent({ providedSecret: 'shared-secret', rawPayload: actionableEvent });
  assert.equal(result.accepted, true);
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(nudgeReconciliationFn.mock.callCount(), 1);
});
