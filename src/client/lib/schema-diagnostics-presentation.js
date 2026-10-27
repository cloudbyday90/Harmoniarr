/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const schemaDiagnosticsMessages = Object.freeze({
  idle: 'Schema maintenance status will load automatically.',
  loading: 'Loading schema maintenance status…',
  pending: 'Schema checks will run automatically through maintenance.',
  running: 'Automatic schema checks are running…',
  paused: 'Schema checks are paused during recovery maintenance and will resume automatically.',
  stale: 'The previous schema check is out of date. Maintenance will check again automatically.',
  current: 'Latest maintenance check: migration records and critical schema checks are current.',
  attention: 'The latest maintenance check found changes that need attention. Review the results below.',
  busy: 'Schema checks are waiting for database preparation. Maintenance will retry automatically.',
  unavailable: 'Schema status is unavailable. Maintenance continues checking automatically.',
  forbidden: 'Administrator access is required to view schema checks.',
  limited: 'Schema status is temporarily limited. It will reload the next time this view opens.',
});

export function projectSchemaDiagnosticsPayload(payload) {
  const report = payload?.schemaDiagnostics;
  if (['busy', 'unavailable', 'pending', 'running', 'paused', 'stale'].includes(report?.state)) {
    return { state: report.state, ...(typeof report.checkedAt === 'string' && Number.isFinite(Date.parse(report.checkedAt)) ? { checkedAt: report.checkedAt } : {}) };
  }
  const count = value => Number.isSafeInteger(value) && value >= 0;
  if (!['current', 'attention'].includes(report?.state) || !['current', 'not_current', 'unavailable'].includes(report.lineage?.state)
    || !['current', 'drift'].includes(report.anchors?.state) || !['checkedCount', 'missingCount', 'alteredCount'].every(key => count(report.anchors[key]))) return { state: 'unavailable' };
  if (report.anchors.checkedCount < 1 || report.anchors.missingCount + report.anchors.alteredCount > report.anchors.checkedCount
    || (report.state === 'current' && (report.lineage.state !== 'current' || report.anchors.state !== 'current'
      || report.anchors.missingCount || report.anchors.alteredCount || !count(report.lineage.expectedRows)
      || report.lineage.expectedRows < 1 || report.lineage.observedRows !== report.lineage.expectedRows))) return { state: 'unavailable' };
  return { state: report.state, checkedAt: typeof report.checkedAt === 'string' && Number.isFinite(Date.parse(report.checkedAt)) ? report.checkedAt : null,
    lineage: { state: report.lineage.state, expectedRows: count(report.lineage.expectedRows) ? report.lineage.expectedRows : null,
      observedRows: count(report.lineage.observedRows) ? report.lineage.observedRows : null, incomplete: report.lineage.incomplete === true,
      ...Object.fromEntries(['pendingCount', 'unknownAppliedCount', 'checksumDriftCount', 'migrationKeyDriftCount', 'nonAppliedCount']
        .map(key => [key, count(report.lineage[key]) ? report.lineage[key] : null])) },
    anchors: { state: report.anchors.state, checkedCount: report.anchors.checkedCount, missingCount: report.anchors.missingCount, alteredCount: report.anchors.alteredCount } };
}
