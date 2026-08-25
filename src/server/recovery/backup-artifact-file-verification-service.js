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
import { readFile, stat } from 'node:fs/promises';
import { createBackupEncryptionService } from './backup-encryption-service.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function toSafeSize(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function arraysMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function createUnverifiedResult(code) {
  return {
    code,
    status: 'unverified',
  };
}

function verifyManifest({ artifact, payload }) {
  const manifest = artifact?.manifest;
  if (!manifest || typeof manifest !== 'object') {
    return 'manifest_missing';
  }

  if (payload?.formatVersion !== artifact.formatVersion || payload.formatVersion !== manifest.formatVersion) {
    return 'manifest_format_version_mismatch';
  }

  if (payload?.backup?.type !== artifact.backupType || payload.backup.type !== manifest?.backup?.type) {
    return 'manifest_backup_type_mismatch';
  }

  if (payload?.backup?.encrypted !== artifact.encrypted || payload.backup.encrypted !== manifest?.backup?.encrypted) {
    return 'manifest_encryption_mismatch';
  }

  if (!arraysMatch(payload?.backup?.scope, artifact.scope) || !arraysMatch(payload.backup.scope, manifest?.backup?.scope)) {
    return 'manifest_scope_mismatch';
  }

  if (payload.exportedAt !== manifest.exportedAt) {
    return 'manifest_exported_at_mismatch';
  }

  if (payload?.application?.name !== manifest?.application?.name || payload?.application?.version !== manifest?.application?.version) {
    return 'manifest_application_mismatch';
  }

  if (payload?.schema?.migrationLevel !== manifest?.schema?.migrationLevel) {
    return 'manifest_schema_mismatch';
  }

  return null;
}

/**
 * Verifies the file-system and semantic identity of a logical backup artifact.
 * A caller may add an expected raw-file checksum for an interrupted operation;
 * regular artifact metadata still provides plaintext checksum and manifest checks.
 */
export function createBackupArtifactFileVerificationService({
  backupEncryptionService = createBackupEncryptionService(),
  readFileFn = readFile,
  sha256Fn = sha256,
  statFn = stat,
} = {}) {
  async function verifyBackupArtifactFile({
    artifact,
    expectedFileSha256 = null,
    expectedFileSizeBytes = null,
    storagePath = artifact?.storagePath,
  } = {}) {
    if (!artifact || typeof storagePath !== 'string' || storagePath.trim().length === 0) {
      return createUnverifiedResult('artifact_storage_path_invalid');
    }

    let fileStats;
    let content;
    try {
      [fileStats, content] = await Promise.all([
        statFn(storagePath),
        readFileFn(storagePath),
      ]);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {
          code: 'artifact_file_missing',
          status: 'missing',
        };
      }

      return createUnverifiedResult('artifact_file_unreadable');
    }

    if (typeof fileStats?.isFile === 'function' && !fileStats.isFile()) {
      return createUnverifiedResult('artifact_path_not_file');
    }

    const actualFileSizeBytes = toSafeSize(fileStats?.size) ?? Buffer.byteLength(content);
    const requiredFileSizeBytes = toSafeSize(expectedFileSizeBytes) ?? toSafeSize(artifact.fileSizeBytes);
    if (requiredFileSizeBytes === null || actualFileSizeBytes !== requiredFileSizeBytes) {
      return createUnverifiedResult('artifact_file_size_mismatch');
    }

    const actualFileSha256 = sha256Fn(content);
    if (typeof expectedFileSha256 === 'string' && expectedFileSha256.length > 0 && expectedFileSha256 !== actualFileSha256) {
      return createUnverifiedResult('artifact_file_checksum_mismatch');
    }

    const serialized = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);
    const envelope = backupEncryptionService.inspectBackupEnvelope(serialized);
    if (envelope.encrypted !== artifact.encrypted) {
      return createUnverifiedResult('artifact_encryption_posture_mismatch');
    }

    if (envelope.encrypted && !backupEncryptionService.isEncryptionAvailable()) {
      return createUnverifiedResult('artifact_encryption_key_unavailable');
    }

    let plaintext;
    try {
      plaintext = backupEncryptionService.detectAndDecrypt(serialized).decrypted;
    } catch {
      return createUnverifiedResult('artifact_payload_decryption_failed');
    }

    const actualPayloadSha256 = sha256Fn(plaintext);
    if (typeof artifact.payloadSha256 !== 'string' || artifact.payloadSha256.length === 0 || artifact.payloadSha256 !== actualPayloadSha256) {
      return createUnverifiedResult('artifact_payload_checksum_mismatch');
    }

    let payload;
    try {
      payload = JSON.parse(plaintext);
    } catch {
      return createUnverifiedResult('artifact_payload_unparseable');
    }

    const manifestMismatch = verifyManifest({ artifact, payload });
    if (manifestMismatch) {
      return createUnverifiedResult(manifestMismatch);
    }

    return {
      fileSha256: actualFileSha256,
      fileSizeBytes: actualFileSizeBytes,
      payloadSha256: actualPayloadSha256,
      status: 'verified',
    };
  }

  return {
    verifyBackupArtifactFile,
  };
}
