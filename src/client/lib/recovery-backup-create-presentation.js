/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Describes the user-visible result of creating a recovery backup. It keeps
 * operational state out of the view and never exposes artifact storage data.
 *
 * @param {{ isCreating?: boolean, lastCreatedBackupArtifact?: { id?: string } | null }} input
 * @returns {{ message: string, state: 'creating' | 'created' | 'idle' }}
 */
export function buildRecoveryBackupCreateStatus({
  isCreating = false,
  lastCreatedBackupArtifact = null,
} = {}) {
  if (isCreating) {
    return {
      message: 'Creating backup. You can review it when it is ready.',
      state: 'creating',
    };
  }

  if (typeof lastCreatedBackupArtifact?.id === 'string' && lastCreatedBackupArtifact.id.trim().length > 0) {
    return {
      message: 'Backup created. Review it in backup history below.',
      state: 'created',
    };
  }

  return {
    message: '',
    state: 'idle',
  };
}
