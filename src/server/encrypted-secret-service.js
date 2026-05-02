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

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createApiError } from './auth.js';
import { getPool } from './database.js';

const encryptionAlgorithm = 'aes-256-gcm';
const encryptionIvBytes = 12;

export const secretEncryptionKeyEnvVar = 'HARMONIARR_SECRET_ENCRYPTION_KEY';

export function resolveSecretEncryptionKey(value) {
  if (value == null || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  for (const encoding of ['base64', 'base64url']) {
    try {
      const key = Buffer.from(normalized, encoding);
      if (key.length === 32) {
        return key;
      }
    } catch {
      // Continue trying alternate encodings.
    }
  }

  throw createApiError(
    500,
    'secret_encryption_key_invalid',
    `${secretEncryptionKeyEnvVar} must encode exactly 32 bytes using hex or base64`,
  );
}

export function encryptSecretValue(plaintextValue, encryptionKey) {
  const iv = randomBytes(encryptionIvBytes);
  const cipher = createCipheriv(encryptionAlgorithm, encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintextValue, 'utf8'),
    cipher.final(),
  ]);
  const payload = JSON.stringify({
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  });

  return Buffer.from(payload, 'utf8');
}

export function decryptSecretValue(encryptedValue, encryptionKey) {
  const payload = JSON.parse(Buffer.from(encryptedValue).toString('utf8'));
  const decipher = createDecipheriv(
    encryptionAlgorithm,
    encryptionKey,
    Buffer.from(payload.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function createMissingEncryptionKeyError() {
  return createApiError(
    400,
    'validation_error',
    `${secretEncryptionKeyEnvVar} must be configured before storing encrypted secrets`,
  );
}

export function createEncryptedSecretService({
  env = process.env,
  getPoolFn = getPool,
  encryptionKey = resolveSecretEncryptionKey(env[secretEncryptionKeyEnvVar]),
} = {}) {
  async function getSecretRecord({ secretType, name, queryable = getPoolFn() }) {
    const result = await queryable.query(
      `
        SELECT id, encrypted_value, encryption_key_version, metadata, updated_at
        FROM encrypted_secrets
        WHERE secret_type = $1 AND name = $2
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      [secretType, name],
    );

    return result.rows[0] ?? null;
  }

  async function getSecretMetadata({ secretType, name, queryable }) {
    const record = await getSecretRecord({ secretType, name, queryable });
    return {
      configured: Boolean(record),
      updatedAt: record?.updated_at ?? null,
    };
  }

  async function getSecretValue({ secretType, name, queryable }) {
    const record = await getSecretRecord({ secretType, name, queryable });
    if (!record) {
      return null;
    }

    if (!encryptionKey) {
      throw createApiError(
        500,
        'secret_encryption_key_missing',
        `${secretEncryptionKeyEnvVar} must be configured to decrypt persisted secrets`,
      );
    }

    return decryptSecretValue(record.encrypted_value, encryptionKey);
  }

  async function setSecretValue({ secretType, name, plaintextValue, metadata = null, queryable = getPoolFn() }) {
    const normalizedValue = typeof plaintextValue === 'string' ? plaintextValue.trim() : '';
    if (!normalizedValue) {
      throw createApiError(400, 'validation_error', `${name} must be a non-empty string`);
    }

    if (!encryptionKey) {
      throw createMissingEncryptionKeyError();
    }

    await queryable.query(
      'DELETE FROM encrypted_secrets WHERE secret_type = $1 AND name = $2',
      [secretType, name],
    );

    await queryable.query(
      `
        INSERT INTO encrypted_secrets (
          secret_type,
          name,
          encrypted_value,
          encryption_key_version,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
      `,
      [
        secretType,
        name,
        encryptSecretValue(normalizedValue, encryptionKey),
        `env:${secretEncryptionKeyEnvVar}`,
        JSON.stringify(metadata),
      ],
    );
  }

  async function clearSecretValue({ secretType, name, queryable = getPoolFn() }) {
    await queryable.query(
      'DELETE FROM encrypted_secrets WHERE secret_type = $1 AND name = $2',
      [secretType, name],
    );
  }

  return {
    clearSecretValue,
    getSecretMetadata,
    getSecretRecord,
    getSecretValue,
    setSecretValue,
  };
}