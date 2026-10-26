/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readinessCodeCategories, readinessStages, readinessFailureLimit } from '../../shared/readiness-diagnostic-descriptors.js';
export { readinessFailureLimit };
export const readinessLogIntervalMs = 15_000;
export const normalizeReadinessStage = value => readinessStages.includes(value) ? value : 'unknown';

const categories = new Map(Object.entries(readinessCodeCategories));

/** Do not evaluate getters, stringify arbitrary failures, or inspect raw messages. */
export function readOwnDiagnosticValue(value, key) {
  try { return value && Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; }
}

export function classifyReadinessFailure(error) {
  const candidate = readOwnDiagnosticValue(error, 'code');
  const code = typeof candidate === 'string' && categories.has(candidate) ? candidate : null;
  const category = categories.get(code) ?? 'unknown';
  const status = readOwnDiagnosticValue(error, 'status');
  // Match the existing application's database connection mapping, including connect syscall errors.
  const connection = ['connection_failure', 'database_connection'].includes(category)
    || readOwnDiagnosticValue(error, 'syscall') === 'connect';
  return { code, category, httpStatus: connection ? 503 : Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500 };
}

export const incrementDiagnosticCount = value => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
