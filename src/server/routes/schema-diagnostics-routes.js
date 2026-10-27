/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { asyncRoute } from '../http.js';
import { unavailableSchemaDiagnostics } from '../schema-diagnostics-service.js';

export function registerSchemaDiagnosticsRoutes(app, { requireAdminSession, getSchemaDiagnostics, limitSchemaDiagnostics }) {
  app.get('/api/v1/system/diagnostics/schema-state', asyncRoute(async (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    await requireAdminSession(request);
    next();
  }), limitSchemaDiagnostics, asyncRoute(async (request, response) => {
    let result;
    try { result = await getSchemaDiagnostics(); }
    catch { result = unavailableSchemaDiagnostics(); }
    if (response.destroyed) return;
    // Snapshot access still requires current administrator authority.
    await requireAdminSession(request);
    if (!response.destroyed) response.json({ ok: true, schemaDiagnostics: result });
  }));
}
