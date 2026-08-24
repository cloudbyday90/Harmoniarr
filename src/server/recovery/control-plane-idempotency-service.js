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

function computeExpiry({ getNow, ttlMilliseconds }) {
  const expiresAt = new Date(getNow().getTime() + ttlMilliseconds);
  return expiresAt.toISOString();
}

function isExpired(record, now) {
  return record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime();
}

export function createControlPlaneIdempotencyService({
  completeRecord = null,
  createInProgressRecord = null,
  deleteExpiredRecordById = null,
  deleteInProgressRecordById = null,
  getNow = () => new Date(),
  getRecordByScopeActorAndKey = null,
  inProgressTtlMinutes = 60,
  idempotencyStore = createControlPlaneIdempotencyStore(),
  ttlHours = 48,
} = {}) {
  const completeRecordFn = completeRecord ?? idempotencyStore.completeRecord;
  const createInProgressRecordFn = createInProgressRecord ?? idempotencyStore.createInProgressRecord;
  const deleteExpiredRecordByIdFn = deleteExpiredRecordById ?? idempotencyStore.deleteExpiredRecordById;
  const deleteInProgressRecordByIdFn = deleteInProgressRecordById ?? idempotencyStore.deleteInProgressRecordById;
  const getRecordFn = getRecordByScopeActorAndKey ?? idempotencyStore.getRecordByScopeActorAndKey;

  function createPayloadMismatchError() {
    return createApiError(409, 'idempotency_key_payload_mismatch', 'Idempotency key was already used with a different request payload');
  }

  function createInProgressError() {
    return createApiError(409, 'idempotency_key_in_progress', 'This action is already being processed. Try again shortly.');
  }

  async function findExistingOutcome({ actorUserId, idempotencyKey, operationScope, requestHash }) {
    const existingRecord = await getRecordFn({
      actorUserId,
      idempotencyKey,
      operationScope,
    });

    if (!existingRecord) {
      return null;
    }

    const now = getNow();
    if (isExpired(existingRecord, now)) {
      await deleteExpiredRecordByIdFn({
        id: existingRecord.id,
        now: now.toISOString(),
      });
      return null;
    }

    if (existingRecord.requestHash !== requestHash) {
      throw createPayloadMismatchError();
    }

    if (existingRecord.state === 'in_progress') {
      throw createInProgressError();
    }

    return {
      body: existingRecord.response,
      replayed: true,
      statusCode: existingRecord.statusCode,
    };
  }

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

    for (;;) {
      const existingOutcome = await findExistingOutcome({
        actorUserId,
        idempotencyKey: normalizedIdempotencyKey,
        operationScope,
        requestHash,
      });

      if (existingOutcome) {
        return existingOutcome;
      }

      const reservation = await createInProgressRecordFn({
        actorUserId,
        expiresAt: computeExpiry({
          getNow,
          ttlMilliseconds: inProgressTtlMinutes * 60 * 1000,
        }),
        idempotencyKey: normalizedIdempotencyKey,
        operationScope,
        requestHash,
      });

      if (!reservation) {
        continue;
      }

      let mutationCompleted = false;

      try {
        const result = await executeMutation();
        mutationCompleted = true;
        const completedRecord = await completeRecordFn({
          expiresAt: computeExpiry({
            getNow,
            ttlMilliseconds: ttlHours * 60 * 60 * 1000,
          }),
          id: reservation.id,
          response: result?.body ?? {},
          statusCode: result?.statusCode ?? 200,
        });

        if (!completedRecord) {
          throw new Error('Idempotency reservation was not available to complete');
        }

        return {
          body: result?.body ?? {},
          replayed: false,
          statusCode: result?.statusCode ?? 200,
        };
      } catch (error) {
        if (!mutationCompleted) {
          await deleteInProgressRecordByIdFn({ id: reservation.id });
        }

        throw error;
      }
    }
  }

  return {
    executeIdempotentMutation,
  };
}
