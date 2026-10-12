/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createLibraryOrganizeMutationService } from '../../src/server/library/library-organize-mutation-service.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';

/** A controlled plan over real catalog rows and test-owned bytes; production mutation guards stay intact. */
export async function seedOrganizeLifetimeFixture({ getPoolFn, workspaceDir }) {
  const pool = getPoolFn(); const root = join(workspaceDir, 'library');
  const source = join(root, 'incoming', 'Original.flac'); const destination = join(root, 'Artist', 'Album', 'Track.flac');
  const bytes = Buffer.from('Owned organize lifetime bytes.\n');
  await mkdir(dirname(source), { recursive: true }); await writeFile(source, bytes);
  const rootId = (await pool.query(`INSERT INTO library_roots(name,path,canonical_path)
    VALUES('Organize lifetime',$1,$1) RETURNING id`, [root])).rows[0].id;
  const fileId = (await pool.query(`INSERT INTO library_files(library_root_id,canonical_path,relative_path,filename,extension,size_bytes)
    VALUES($1,$2,'incoming/Original.flac','Original.flac','flac',$3) RETURNING id`, [rootId, source, bytes.length])).rows[0].id;
  const file = { fileId, libraryRootId: rootId, libraryRootPath: root, currentPath: source, proposedPath: destination,
    proposedRelativePath: 'Artist/Album/Track.flac', match: { artistName: 'Controlled artist', releaseTitle: 'Controlled album' },
    status: { code: 'rename_required' } };
  const filesystem = createMediaFilesystemService();
  const maintenance = createMaintenanceLockService({ getPoolFn });
  const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
  const mutation = createLibraryOrganizeMutationService({ withTransaction: createDatabaseTransactionRunner({ getPoolFn }),
    applyExclusiveFileMutationPlan: filesystem.applyExclusiveFileMutationPlan,
    assertMaintenanceWriteAllowed: ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable }),
  });
  return { file, bytes, source, destination, ...mutation, createExclusiveFileMutationPlan: filesystem.createExclusiveFileMutationPlan,
    readPath: async () => (await pool.query('SELECT canonical_path FROM library_files WHERE id=$1', [fileId])).rows[0].canonical_path,
    readRun: async id => (await pool.query('SELECT status FROM operation_runs WHERE id=$1', [id])).rows[0],
    readDestination: () => readFile(destination),
  };
}
