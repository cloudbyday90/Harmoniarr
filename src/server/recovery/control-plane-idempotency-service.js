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

import { createHash } from 'node:crypto';
import { createApiError } from '../auth.js';
import { createControlPlaneIdempotencyStore } from './control-plane-idempotency-store.js';

function hashRequestPayload(requestPayload) {
  const normalizedPayload = requestPayload ?? null;
  return createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
}

function normalizeIdempotencyKey(idempotencyKey) {
  if (typeof idempotencyKey !== 'string') {
    return null;
  }

  const trimmed = idempotencyKey.trim();
  if (trimmed.length < 1) {
    return null;
  }

  if (trimmed.length > 255) {
    throw createApiError(400, 'idempotency_key_invalid', 'Idempotency key length exceeds the supported maximum');
  }

  return trimmed;
}

function computeExpiry({ getNow, ttlHours }) {
  const expiresAt = new Date(getNow().getTime() + (ttlHours * 60 * 60 * 1000));
  return expiresAt.toISOString();
}

export function createControlPlaneIdempotencyService({
  createRecord = null,
  deleteRecordById = null,
  getNow = () => new Date(),
  getRecordByScopeActorAndKey = null,
  idempotencyStore = createControlPlaneIdempotencyStore(),
  ttlHours = 48,
} = {}) {
  const createRecordFn = createRecord ?? idempotencyStore.createRecord;
  const deleteRecordByIdFn = deleteRecordById ?? idempotencyStore.deleteRecordById;
  const getRecordFn = getRecordByScopeActorAndKey ?? idempotencyStore.getRecordByScopeActorAndKey;

  async function executeIdempotentMutation({
    actorUserId = null,
    executeMutation,
    idempotencyKey = null,
    operationScope,
    requestPayload = null,
  }) {
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

    if (!normalizedIdempotencyKey) {
      return executeMutation();
    }

    if (typeof operationScope !== 'string' || operationScope.trim().length < 1) {
      throw new Error('operationScope is required when idempotencyKey is provided');
    }

    const requestHash = hashRequestPayload(requestPayload);

    const existingRecord = await getRecordFn({
      actorUserId,
      idempotencyKey: normalizedIdempotencyKey,
      operationScope,
    });

    if (existingRecord) {
      if (existingRecord.expiresAt && new Date(existingRecord.expiresAt).getTime() <= getNow().getTime()) {
        await deleteRecordByIdFn({ id: existingRecord.id });
      } else {
        if (existingRecord.requestHash !== requestHash) {
          throw createApiError(409, 'idempotency_key_payload_mismatch', 'Idempotency key was already used with a different request payload');
        }

        return {
          body: existingRecord.response,
          replayed: true,
          statusCode: existingRecord.statusCode,
        };
      }
    }

    const result = await executeMutation();

    try {
      await createRecordFn({
        actorUserId,
        expiresAt: computeExpiry({ getNow, ttlHours }),
        idempotencyKey: normalizedIdempotencyKey,
        operationScope,
        requestHash,
        response: result?.body ?? {},
        statusCode: result?.statusCode ?? 200,
      });
    } catch (error) {
      if (error?.code === '23505') {
        const replayRecord = await getRecordFn({
          actorUserId,
          idempotencyKey: normalizedIdempotencyKey,
          operationScope,
        });

        if (!replayRecord) {
          throw error;
        }

        if (replayRecord.requestHash !== requestHash) {
          throw createApiError(409, 'idempotency_key_payload_mismatch', 'Idempotency key was already used with a different request payload');
        }

        return {
          body: replayRecord.response,
          replayed: true,
          statusCode: replayRecord.statusCode,
        };
      }

      throw error;
    }

    return {
      body: result?.body ?? {},
      replayed: false,
      statusCode: result?.statusCode ?? 200,
    };
  }

  return {
    executeIdempotentMutation,
  };
}
