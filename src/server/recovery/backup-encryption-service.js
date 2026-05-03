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

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { resolveSecretEncryptionKey, secretEncryptionKeyEnvVar } from '../encrypted-secret-service.js';

const encryptionAlgorithm = 'aes-256-gcm';
const ivBytes = 12;

export function computeKeyFingerprint(encryptionKey) {
  return createHash('sha256').update(encryptionKey).digest('hex');
}

function isEnvelopeFormat(parsed) {
  return parsed
    && parsed.encrypted === true
    && typeof parsed.encryption === 'object'
    && typeof parsed.encryption.ciphertext === 'string'
    && typeof parsed.encryption.iv === 'string'
    && typeof parsed.encryption.tag === 'string';
}

export function createBackupEncryptionService({
  env = process.env,
  encryptionKey = resolveSecretEncryptionKey(env[secretEncryptionKeyEnvVar]),
} = {}) {
  function isEncryptionAvailable() {
    return encryptionKey != null;
  }

  function getKeyFingerprint() {
    if (!encryptionKey) {
      return null;
    }

    return computeKeyFingerprint(encryptionKey);
  }

  function encryptBackupPayload(plaintext) {
    if (!encryptionKey) {
      throw new Error('Backup encryption requires a configured encryption key');
    }

    const iv = randomBytes(ivBytes);
    const cipher = createCipheriv(encryptionAlgorithm, encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return JSON.stringify({
      encrypted: true,
      encryption: {
        algorithm: encryptionAlgorithm,
        ciphertext: ciphertext.toString('base64url'),
        iv: iv.toString('base64url'),
        keyFingerprint: computeKeyFingerprint(encryptionKey),
        tag: cipher.getAuthTag().toString('base64url'),
      },
    });
  }

  function decryptBackupPayload(serialized) {
    if (!encryptionKey) {
      throw new Error('Backup decryption requires a configured encryption key');
    }

    const parsed = JSON.parse(serialized);
    if (!isEnvelopeFormat(parsed)) {
      throw new Error('Backup payload is not in encrypted envelope format');
    }

    const { encryption } = parsed;
    const decipher = createDecipheriv(
      encryptionAlgorithm,
      encryptionKey,
      Buffer.from(encryption.iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(encryption.tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryption.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  function detectAndDecrypt(serialized) {
    try {
      const parsed = JSON.parse(serialized);
      if (isEnvelopeFormat(parsed)) {
        return {
          decrypted: decryptBackupPayload(serialized),
          encrypted: true,
          keyFingerprint: parsed.encryption.keyFingerprint ?? null,
        };
      }
    } catch {
      // Not JSON or not envelope - treat as plaintext
    }

    return {
      decrypted: serialized,
      encrypted: false,
      keyFingerprint: null,
    };
  }

  return {
    decryptBackupPayload,
    detectAndDecrypt,
    encryptBackupPayload,
    getKeyFingerprint,
    isEncryptionAvailable,
  };
}
