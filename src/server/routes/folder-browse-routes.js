/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { asyncRoute } from '../http.js';
import { createFolderBrowseService } from '../filesystem/folder-browse-service.js';

export function registerFolderBrowseRoutes(app, { requireAdminSession, browseDirectory = createFolderBrowseService().browse }) {
  app.get('/api/v1/system/fs/browse', asyncRoute(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const session = await requireAdminSession(request);
    if (request.aborted || response.destroyed) return;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort); response.once('close', abort);
    try {
      const result = await browseDirectory({ path: request.query.path, cursor: request.query.cursor,
        actorUserId: session.appUserId, signal: controller.signal });
      if (!controller.signal.aborted) response.json(result);
    } finally { request.off('aborted', abort); response.off('close', abort); }
  }));
}
