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

import { getPool } from '../database.js';
import { createOperatorArtistReconciliationSnapshotStore } from './operator-artist-reconciliation-snapshot-store.js';

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function createUserNotFoundError(userId) {
  const error = new Error(`App user was not found: ${userId}`);
  error.status = 404;
  error.code = 'app_user_not_found';
  return error;
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'validation_error';
  return error;
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

export function normalizeOperatorArtistReconciliationSnapshotPayload(snapshotPayload) {
  if (!isPlainObject(snapshotPayload)) {
    throw createValidationError('snapshotPayload must be a plain object');
  }

  return structuredClone(snapshotPayload);
}

export function createOperatorArtistReconciliationSnapshotService({
  getPoolFn = getPool,
  maxSaveRetries = 3,
  operatorArtistReconciliationSnapshotStore = createOperatorArtistReconciliationSnapshotStore(),
} = {}) {
  async function ensureUserExists(appUserId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM app_users WHERE id = $1 LIMIT 1',
      [appUserId],
    );

    if (result.rows.length === 0) {
      throw createUserNotFoundError(appUserId);
    }
  }

  async function ensureArtistExists(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM metadata_artists WHERE id = $1 LIMIT 1',
      [metadataArtistId],
    );

    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('artist', metadataArtistId);
    }
  }

  async function getLatestOperatorArtistReconciliationSnapshot({
    appUserId,
    metadataArtistId,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    return operatorArtistReconciliationSnapshotStore.getLatestOperatorArtistReconciliationSnapshot({
      appUserId,
      metadataArtistId,
    });
  }

  async function getOperatorArtistReconciliationSnapshotById({
    appUserId,
    metadataArtistId,
    snapshotId,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    return operatorArtistReconciliationSnapshotStore.getOperatorArtistReconciliationSnapshotById({
      appUserId,
      metadataArtistId,
      snapshotId,
    });
  }

  async function saveOperatorArtistReconciliationSnapshot({
    appUserId,
    metadataArtistId,
    snapshotPayload,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    const normalizedPayload = normalizeOperatorArtistReconciliationSnapshotPayload(snapshotPayload);

    for (let attempt = 0; attempt < maxSaveRetries; attempt += 1) {
      try {
        return await operatorArtistReconciliationSnapshotStore.createOperatorArtistReconciliationSnapshot({
          appUserId,
          metadataArtistId,
          snapshotPayload: normalizedPayload,
        });
      } catch (error) {
        if (!isUniqueViolation(error) || attempt + 1 >= maxSaveRetries) {
          throw error;
        }
      }
    }

    throw createValidationError('Unable to allocate a reconciliation snapshot revision');
  }

  return {
    getOperatorArtistReconciliationSnapshotById,
    getLatestOperatorArtistReconciliationSnapshot,
    saveOperatorArtistReconciliationSnapshot,
  };
}
