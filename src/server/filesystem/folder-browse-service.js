/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { opendir, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createApiError, getPublicApiError } from '../api-error.js';
import { createFolderCursorPolicy, folderPageChanged } from './folder-cursor-policy.js';
import { createFolderPageSelector } from './folder-page-selector.js';
import { FOLDER_PAGE_SIZE, FOLDER_PATH_LIMIT, FOLDER_SCAN_LIMIT } from '../../shared/folder-browse-policy.js';

const metadata = row => [row.dev, row.ino, row.mtimeNs, row.ctimeNs].map(String).join(':');
const digest = value => createHash('sha256').update(value).digest('hex');
const failure = (status, code, message) => createApiError(status, code, message);
function publicFailure(error) {
  if (getPublicApiError(error) || error?.name === 'AbortError') return error;
  switch (error?.code) {
    case 'EACCES': case 'EPERM': return failure(403, 'folder_access_denied', 'Permission denied.');
    case 'ENOENT': return failure(404, 'folder_not_found', 'Folder not found.');
    case 'ENOTDIR': return failure(400, 'folder_not_directory', 'That path is a file, not a folder.');
    default: return failure(500, 'folder_read_failed', 'Could not read this folder.');
  }
}

/** No idle handles or queued work. Capacity retires only after actual close. */
export function createFolderBrowseService({ openDirectory = opendir, readStat = stat,
  cursorPolicy = createFolderCursorPolicy(), now = () => performance.now() } = {}) {
  let active = 0;
  async function browse({ path = '/', cursor, actorUserId, signal } = {}) {
    if (typeof path !== 'string' || path.length > FOLDER_PATH_LIMIT || path.includes('\0')
      || typeof actorUserId !== 'string' || !actorUserId || actorUserId.length > 128) {
      throw failure(400, 'folder_query_invalid', 'Invalid folder browse request.');
    }
    const continuation = cursorPolicy.decode(cursor);
    const safePath = resolve(path);
    if (safePath.length > FOLDER_PATH_LIMIT) throw failure(400, 'folder_query_invalid', 'Invalid folder browse request.');
    signal?.throwIfAborted();
    if (active >= 4) throw failure(503, 'folder_browse_busy', 'Folder browsing is busy. Try again shortly.');
    active++;
    const deadline = now() + 5000;
    function checkpoint() {
      signal?.throwIfAborted();
      if (now() >= deadline) throw failure(503, 'folder_browse_timeout', 'This folder took too long to read. Enter a more specific path.');
    }
    let directory, result, primary, failed = false;
    try {
      try {
        checkpoint();
        const before = await readStat(safePath, { bigint: true }); checkpoint();
        if (!before.isDirectory()) throw failure(400, 'folder_not_directory', 'That path is a file, not a folder.');
        const fingerprint = metadata(before);
        const context = digest(JSON.stringify([actorUserId, safePath, fingerprint]));
        if (continuation && continuation.context !== context) throw folderPageChanged();
        directory = await openDirectory(safePath, { bufferSize: 32 }); checkpoint();
        const selector = createFolderPageSelector(continuation ?? {});
        let scanned = 0;
        for (;;) {
          checkpoint(); const entry = await directory.read(); checkpoint();
          if (entry === null) break;
          if (++scanned > FOLDER_SCAN_LIMIT) throw failure(422, 'folder_scan_limit', 'This folder is too large to browse. Enter a more specific path.');
          if (entry.isDirectory()) {
            if (typeof entry.name !== 'string' || !entry.name || entry.name.length > 512
              || basename(entry.name) !== entry.name || ['.', '..'].includes(entry.name) || entry.name.includes('\0')) {
              throw failure(500, 'folder_read_failed', 'Could not read this folder.');
            }
            selector.add(entry.name);
          }
        }
        const after = await readStat(safePath, { bigint: true }); checkpoint();
        if (!after.isDirectory() || metadata(after) !== fingerprint) throw folderPageChanged();
        const page = selector.result();
        if (continuation && !page.names.length) throw folderPageChanged();
        const makeCursor = (anchor, direction) => cursorPolicy.encode({ anchor, direction, context });
        result = { ok: true, path: safePath, parent: dirname(safePath) === safePath ? null : dirname(safePath),
          entries: page.names.map(name => ({ name, path: resolve(safePath, name) })),
          page: { limit: FOLDER_PAGE_SIZE, total: page.total, from: page.from, to: page.to,
            previousCursor: page.from > 1 ? makeCursor(page.names[0], 'previous') : null,
            nextCursor: page.to < page.total ? makeCursor(page.names.at(-1), 'next') : null } };
      } catch (error) { failed = true; primary = error; }
      try { if (directory) await directory.close(); if (!failed) checkpoint(); }
      catch (error) { if (!failed) { failed = true; primary = error; } }
      if (failed) throw publicFailure(primary);
      return result;
    } finally { active--; }
  }
  return { browse };
}
