/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash } from 'node:crypto';

export function createBackupArtifactFixture({ storagePath, filename = 'harmoniarr_backup_2026-08-25T12-00-00-000Z_operation-1.json' }) {
  const manifest = {
    application: {
      name: 'harmoniarr',
      version: '0.1.0-beta',
    },
    backup: {
      encrypted: false,
      scope: ['settings'],
      type: 'logical',
    },
    exportedAt: '2026-08-25T12:00:00.000Z',
    formatVersion: '1',
    schema: {
      migrationLevel: 'applied:99',
    },
  };
  const content = JSON.stringify({
    ...manifest,
    data: {
      settings: {},
    },
  }, null, 2);

  return {
    artifact: {
      ...manifest,
      backupType: manifest.backup.type,
      encrypted: false,
      fileSizeBytes: Buffer.byteLength(content),
      filename,
      manifest,
      payloadSha256: createHash('sha256').update(content).digest('hex'),
      scope: manifest.backup.scope,
      storagePath,
    },
    content,
  };
}
