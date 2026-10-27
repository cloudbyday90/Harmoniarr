/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { apiRequest } from './api.js';

export function fetchSchemaDiagnostics({ signal } = {}) {
  return apiRequest('/api/v1/system/diagnostics/schema-state', { signal, headers: { 'Cache-Control': 'no-store' } });
}
