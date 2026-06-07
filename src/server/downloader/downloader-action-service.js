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

import { createApiError, getRequestMetadata } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import {
  buildDownloaderActionEligibility,
  classifyDownloaderTransferState,
} from './downloader-transfer-policy.js';

const supportedTransferActions = new Set(['cancel', 'remove']);

function normalizeString(value, fieldName, { maxLength = 255 } = {}) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or less`);
  }

  return normalized;
}

function normalizeTransferAction(value) {
  const normalized = normalizeString(value, 'action', { maxLength: 40 });
  if (!supportedTransferActions.has(normalized)) {
    throw createApiError(400, 'downloader_action_not_supported', `Downloader action "${normalized}" is not supported`);
  }

  return normalized;
}

function findActionEligibility(transfer, action) {
  const eligibility = buildDownloaderActionEligibility(transfer);
  const actionEligibility = eligibility.actions.find((entry) => entry.code === action);
  if (!actionEligibility?.enabled) {
    throw createApiError(
      409,
      'downloader_action_not_allowed',
      `Downloader action "${action}" is not allowed for this transfer state`,
    );
  }

  return { actionEligibility, eligibility };
}

async function recordActionAudit({
  action,
  actorUserId,
  getRequestMetadataFn,
  recordAuditEventFn,
  request,
  result,
  transfer,
}) {
  if (typeof recordAuditEventFn !== 'function') return;
  const metadata = request
    ? getRequestMetadataFn(request)
    : { ipAddress: null, userAgent: null };
  const state = classifyDownloaderTransferState(transfer);
  await recordAuditEventFn({
    actorType: 'user',
    actorUserId,
    details: {
      action,
      provider: 'slskd',
      sourceUser: result.sourceUser,
      state: state.code,
      transferId: result.id,
    },
    entityId: result.id,
    entityType: 'downloader_transfer',
    eventType: `downloader_transfer_${action}`,
    ipAddress: metadata.ipAddress,
    summary: `Downloader transfer ${action} requested for ${result.sourceUser}`,
    userAgent: metadata.userAgent,
  });
}

export function createDownloaderActionService({
  cancelDownload,
  clearCompletedDownloads,
  getRequestMetadataFn = getRequestMetadata,
  getDownload,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  if (typeof getDownload !== 'function') {
    throw new TypeError('createDownloaderActionService requires getDownload');
  }

  if (typeof cancelDownload !== 'function') {
    throw new TypeError('createDownloaderActionService requires cancelDownload');
  }

  if (typeof clearCompletedDownloads !== 'function') {
    throw new TypeError('createDownloaderActionService requires clearCompletedDownloads');
  }

  async function requestTransferAction({
    action,
    actorUserId,
    id,
    request = null,
    username,
  } = {}) {
    const normalizedAction = normalizeTransferAction(action);
    const normalizedUsername = normalizeString(username, 'username', { maxLength: 255 });
    const normalizedId = normalizeString(id, 'id', { maxLength: 100 });
    const transfer = await getDownload({
      id: normalizedId,
      username: normalizedUsername,
    });

    findActionEligibility(transfer, normalizedAction);

    const result = await cancelDownload({
      id: normalizedId,
      remove: normalizedAction === 'remove',
      username: normalizedUsername,
    });

    await recordActionAudit({
      action: normalizedAction,
      actorUserId,
      getRequestMetadataFn,
      recordAuditEventFn,
      request,
      result,
      transfer,
    });

    return {
      ...result,
      action: normalizedAction,
      state: classifyDownloaderTransferState(transfer),
    };
  }

  async function clearCompleted({ actorUserId, request = null } = {}) {
    const result = await clearCompletedDownloads();
    if (typeof recordAuditEventFn === 'function') {
      const metadata = request
        ? getRequestMetadataFn(request)
        : { ipAddress: null, userAgent: null };
      await recordAuditEventFn({
        actorType: 'user',
        actorUserId,
        details: {
          action: 'clear_completed',
          provider: 'slskd',
        },
        entityType: 'downloader_queue',
        eventType: 'downloader_completed_cleared',
        ipAddress: metadata.ipAddress,
        summary: 'Completed downloader transfers cleared',
        userAgent: metadata.userAgent,
      });
    }

    return result;
  }

  return {
    clearCompleted,
    requestTransferAction,
  };
}
