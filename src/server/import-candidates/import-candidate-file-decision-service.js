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

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { getPool } from '../database.js';
import { getImportCandidateById, insertImportCandidateEvent, listImportCandidateFiles } from './import-candidate-repository.js';
import {
  deleteImportCandidateFileDecision,
  listImportCandidateFileDecisions,
  upsertImportCandidateFileDecision,
} from './import-candidate-file-decision-repository.js';

const skipDecisionType = 'skip';
const allowLossyDerivativeDecisionType = 'allow_lossy_derivative';

function normalizeOptionalString(value, {
  fieldName,
  maxLength,
} = {}) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or less`);
  }

  return normalized;
}

function normalizeRequiredString(value, {
  fieldName,
  maxLength,
}) {
  const normalized = normalizeOptionalString(value, { fieldName, maxLength });
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  return normalized;
}

function normalizeReason(value) {
  return normalizeOptionalString(value, {
    fieldName: 'reason',
    maxLength: 500,
  });
}

export function createImportCandidateFileDecisionService({
  deleteImportCandidateFileDecisionFn = deleteImportCandidateFileDecision,
  getImportCandidateByIdFn = getImportCandidateById,
  insertImportCandidateEventFn = insertImportCandidateEvent,
  listImportCandidateFileDecisionsFn = listImportCandidateFileDecisions,
  listImportCandidateFilesFn = listImportCandidateFiles,
  pool = getPool(),
  previewImportCandidateApply = async () => ({ files: [] }),
  recordAuditEventFn = recordAuditEvent,
  upsertImportCandidateFileDecisionFn = upsertImportCandidateFileDecision,
} = {}) {
  async function withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  function buildDecisionDetails({ candidate, file, reason }) {
    return {
      filename: file.filename,
      folderPath: candidate.folderPath,
      importCandidateFileId: file.id,
      reason,
      sourceProvider: candidate.sourceProvider,
      sourceSearchId: candidate.sourceSearchId,
    };
  }

  async function validateCandidateFile({ client, importCandidateFileId, importCandidateId }) {
    const candidate = await getImportCandidateByIdFn(importCandidateId, client);
    if (!candidate) {
      throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
    }

    if (candidate.status !== 'import_pending') {
      throw createApiError(
        409,
        'import_candidate_not_import_pending',
        'File decisions can only be changed while the candidate is import pending',
      );
    }

    const files = await listImportCandidateFilesFn(importCandidateId, client);
    const file = files.find((entry) => entry.id === importCandidateFileId);
    if (!file) {
      throw createApiError(404, 'import_candidate_file_not_found', 'Import candidate file not found');
    }

    return { candidate, file };
  }

  async function setImportCandidateFileSkipDecision({
    actorUserId = null,
    importCandidateFileId,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    const normalizedImportCandidateId = normalizeRequiredString(importCandidateId, {
      fieldName: 'importCandidateId',
      maxLength: 100,
    });
    const normalizedImportCandidateFileId = normalizeRequiredString(importCandidateFileId, {
      fieldName: 'importCandidateFileId',
      maxLength: 100,
    });
    const normalizedReason = normalizeReason(reason);

    const preview = await previewImportCandidateApply({ importCandidateId: normalizedImportCandidateId });
    const previewFile = preview.files?.find((file) => file.fileId === normalizedImportCandidateFileId);
    if (!previewFile || previewFile.status?.code !== 'collision') {
      throw createApiError(
        409,
        'import_candidate_file_skip_not_available',
        'Only colliding files can be marked to skip during import apply',
      );
    }

    const result = await withTransaction(async (client) => {
      const { candidate, file } = await validateCandidateFile({
        client,
        importCandidateFileId: normalizedImportCandidateFileId,
        importCandidateId: normalizedImportCandidateId,
      });

      const decision = await upsertImportCandidateFileDecisionFn({
        actorUserId,
        decisionType: skipDecisionType,
        importCandidateFileId: normalizedImportCandidateFileId,
        importCandidateId: normalizedImportCandidateId,
        reason: normalizedReason,
      }, client);

      const event = await insertImportCandidateEventFn({
        actorUserId,
        details: {
          ...buildDecisionDetails({ candidate, file, reason: normalizedReason }),
          decisionType: skipDecisionType,
        },
        eventType: 'import_candidate_file_skip_set',
        importCandidateId: normalizedImportCandidateId,
        newStatus: candidate.status,
        previousStatus: candidate.status,
        reason: normalizedReason,
      }, client);

      return { candidate, decision, event, file };
    });

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      details: {
        ...buildDecisionDetails({ candidate: result.candidate, file: result.file, reason: normalizedReason }),
        decisionType: skipDecisionType,
      },
      entityId: result.decision.id,
      entityType: 'import_candidate_file_decision',
      eventType: 'import_candidate_file_skip_set',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate file marked to skip during apply',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      candidate: result.candidate,
      decision: result.decision,
      event: result.event,
      file: result.file,
    };
  }

  async function setImportCandidateFileAllowLossyDerivativeDecision({
    actorUserId = null,
    importCandidateFileId,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    const normalizedImportCandidateId = normalizeRequiredString(importCandidateId, {
      fieldName: 'importCandidateId',
      maxLength: 100,
    });
    const normalizedImportCandidateFileId = normalizeRequiredString(importCandidateFileId, {
      fieldName: 'importCandidateFileId',
      maxLength: 100,
    });
    const normalizedReason = normalizeReason(reason);

    const preview = await previewImportCandidateApply({ importCandidateId: normalizedImportCandidateId });
    const previewFile = preview.files?.find((file) => file.fileId === normalizedImportCandidateFileId);
    if (!previewFile || previewFile.transcodePlan?.recommendedAction !== 'transcode_candidate') {
      throw createApiError(
        409,
        'import_candidate_file_lossy_decision_not_available',
        'Only lossy transcode candidates can be marked with an explicit allow-lossy-derivative decision',
      );
    }

    const result = await withTransaction(async (client) => {
      const { candidate, file } = await validateCandidateFile({
        client,
        importCandidateFileId: normalizedImportCandidateFileId,
        importCandidateId: normalizedImportCandidateId,
      });

      const decision = await upsertImportCandidateFileDecisionFn({
        actorUserId,
        decisionType: allowLossyDerivativeDecisionType,
        importCandidateFileId: normalizedImportCandidateFileId,
        importCandidateId: normalizedImportCandidateId,
        reason: normalizedReason,
      }, client);

      const event = await insertImportCandidateEventFn({
        actorUserId,
        details: {
          ...buildDecisionDetails({ candidate, file, reason: normalizedReason }),
          decisionType: allowLossyDerivativeDecisionType,
        },
        eventType: 'import_candidate_file_allow_lossy_derivative_set',
        importCandidateId: normalizedImportCandidateId,
        newStatus: candidate.status,
        previousStatus: candidate.status,
        reason: normalizedReason,
      }, client);

      return { candidate, decision, event, file };
    });

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      details: {
        ...buildDecisionDetails({ candidate: result.candidate, file: result.file, reason: normalizedReason }),
        decisionType: allowLossyDerivativeDecisionType,
      },
      entityId: result.decision.id,
      entityType: 'import_candidate_file_decision',
      eventType: 'import_candidate_file_allow_lossy_derivative_set',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate file marked for explicit lossy derivative allowance',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      candidate: result.candidate,
      decision: result.decision,
      event: result.event,
      file: result.file,
    };
  }

  async function clearImportCandidateFileDecision({
    actorUserId = null,
    importCandidateFileId,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    const normalizedImportCandidateId = normalizeRequiredString(importCandidateId, {
      fieldName: 'importCandidateId',
      maxLength: 100,
    });
    const normalizedImportCandidateFileId = normalizeRequiredString(importCandidateFileId, {
      fieldName: 'importCandidateFileId',
      maxLength: 100,
    });
    const normalizedReason = normalizeReason(reason);

    const result = await withTransaction(async (client) => {
      const { candidate, file } = await validateCandidateFile({
        client,
        importCandidateFileId: normalizedImportCandidateFileId,
        importCandidateId: normalizedImportCandidateId,
      });

      const deletedDecision = await deleteImportCandidateFileDecisionFn(normalizedImportCandidateFileId, client);
      if (!deletedDecision) {
        throw createApiError(404, 'import_candidate_file_decision_not_found', 'Import candidate file decision not found');
      }

      const event = await insertImportCandidateEventFn({
        actorUserId,
        details: {
          ...buildDecisionDetails({ candidate, file, reason: normalizedReason }),
          clearedDecisionType: deletedDecision.decisionType,
        },
        eventType: 'import_candidate_file_decision_cleared',
        importCandidateId: normalizedImportCandidateId,
        newStatus: candidate.status,
        previousStatus: candidate.status,
        reason: normalizedReason,
      }, client);

      return { candidate, deletedDecision, event, file };
    });

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      details: {
        ...buildDecisionDetails({ candidate: result.candidate, file: result.file, reason: normalizedReason }),
        clearedDecisionType: result.deletedDecision.decisionType,
      },
      entityId: result.deletedDecision.id,
      entityType: 'import_candidate_file_decision',
      eventType: 'import_candidate_file_decision_cleared',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate file decision cleared',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      candidate: result.candidate,
      clearedDecision: result.deletedDecision,
      event: result.event,
      file: result.file,
    };
  }

  return {
    clearImportCandidateFileDecision,
    listImportCandidateFileDecisions: listImportCandidateFileDecisionsFn,
    setImportCandidateFileAllowLossyDerivativeDecision,
    setImportCandidateFileSkipDecision,
  };
}