/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readinessCategoryLabels, readinessCodeCategories, readinessFailureLimit, readinessStageLabels } from '../../shared/readiness-diagnostic-descriptors.js';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const timestamp = value => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const knownLabel = (labels, value, fallback) => typeof value === 'string' && Object.hasOwn(labels, value) ? labels[value] : fallback;

export function buildReadinessDiagnostics(snapshot) {
  if (snapshot?.scope !== 'process') return null;
  return {
    outcome: snapshot.lastCheck?.outcome === 'healthy' ? 'Healthy' : snapshot.lastCheck?.outcome === 'failed' ? 'Failed' : 'No completed check',
    observedAt: timestamp(snapshot.lastCheck?.observedAt), failureCount: count(snapshot.failureCount),
    loggedCount: count(snapshot.log?.loggedCount), suppressedCount: count(snapshot.log?.suppressedCount),
    backpressured: snapshot.log?.backpressured === true,
    outputUnavailable: snapshot.log?.outputUnavailable === true,
    failures: (Array.isArray(snapshot.recentFailures) ? snapshot.recentFailures : []).slice(0, readinessFailureLimit).map(row => ({
      reference: typeof row?.reference === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(row.reference) ? row.reference : null,
      observedAt: timestamp(row?.observedAt), stage: knownLabel(readinessStageLabels, row?.stage, 'Unknown stage'),
      category: knownLabel(readinessCategoryLabels, row?.category, 'Unclassified failure'),
      code: typeof row?.code === 'string' && Object.hasOwn(readinessCodeCategories, row.code) ? row.code : 'Unavailable',
      httpStatus: Number.isInteger(row?.httpStatus) && row.httpStatus >= 400 && row.httpStatus <= 599 ? row.httpStatus : 'Unavailable',
      durationMs: count(row?.durationMs),
    })),
  };
}
