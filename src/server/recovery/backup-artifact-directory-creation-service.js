/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lstat, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createBackupArtifactDirectorySyncService } from './backup-artifact-directory-sync-service.js';

const maximumDirectoryLevels = 32;
const sameDirectory = (left, right) => left.isDirectory() && right.isDirectory() && left.dev === right.dev && left.ino === right.ino;
const invalidDirectory = () => Object.assign(new Error('Backup directory scope or identity requires inspection'), { code: 'backup_artifact_directory_scope_invalid' });

/** Owns bounded creation and retry-safe directory-entry checkpoints before byte writing. */
export function createBackupArtifactDirectoryCreationService({
  backupsDirectory = process.env.HARMONIARR_BACKUPS ?? '/app/data/backups',
  assertOwnership = async () => {},
  directorySyncService = createBackupArtifactDirectorySyncService({ assertOwnership }),
  lstatFn = lstat,
  mkdirFn = mkdir,
} = {}) {
  if (typeof backupsDirectory !== 'string' || !backupsDirectory.trim()) throw invalidDirectory();
  const root = resolve(backupsDirectory), anchor = dirname(root);
  if (root === anchor) throw invalidDirectory();

  function plan(storagePaths) {
    if (!Array.isArray(storagePaths) || storagePaths.length < 1 || storagePaths.length > 2) throw invalidDirectory();
    const directories = new Set([root]);
    for (const path of storagePaths) {
      if (typeof path !== 'string' || !path.trim()) throw invalidDirectory();
      const suffix = relative(root, dirname(resolve(path)));
      if (isAbsolute(suffix) || suffix === '..' || suffix.startsWith('..'+sep)) throw invalidDirectory();
      const parts = suffix ? suffix.split(sep) : [];
      if (parts.length + 1 > maximumDirectoryLevels) throw invalidDirectory();
      let current = root;
      for (const part of parts) { current = resolve(current, part); directories.add(current); }
    }
    return [...directories].sort((left, right) => left.split(sep).length - right.split(sep).length || left.localeCompare(right));
  }

  async function prepareArtifactDirectories({ storagePaths, createMissing = false } = {}) {
    if (typeof createMissing !== 'boolean') throw invalidDirectory();
    const directories = plan(storagePaths);
    await assertOwnership();
    const snapshots = new Map([[anchor, await lstatFn(anchor, { bigint: true })]]);
    if (!snapshots.get(anchor).isDirectory()) throw invalidDirectory();
    for (const directory of directories) {
      await assertOwnership();
      if (createMissing) {
        try { await mkdirFn(directory, { mode: 0o700 }); }
        catch (error) { if (error?.code !== 'EEXIST') throw error; }
      }
      const facts = await lstatFn(directory, { bigint: true });
      if (!facts.isDirectory()) throw invalidDirectory();
      snapshots.set(directory, facts);
    }
    for (const directory of [...directories].reverse().concat(anchor)) {
      await assertOwnership();
      await directorySyncService.syncDirectory({ directory });
    }
    for (const [directory, initial] of snapshots) {
      await assertOwnership();
      if (!sameDirectory(initial, await lstatFn(directory, { bigint: true }))) throw invalidDirectory();
    }
  }
  return { prepareArtifactDirectories };
}
