/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startDeadlineTask } from './deadline-task-service.js';
export const schemaDiagnosticTimeoutMs = 20_000;
const unavailable = () => Object.assign(new Error('Schema diagnostics deadline or cancellation reached.'), { code: 'schema_diagnostics_unavailable' });

/** Separate caller completion from actual drainage; neither late results nor retries own old work. */
export function startSchemaDiagnosticTask(work, { signal, timeoutMs = schemaDiagnosticTimeoutMs } = {}) {
  return startDeadlineTask(work, { signal, timeoutMs, createTimeoutError: unavailable });
}
