/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const schemaDiagnosticsMessages = Object.freeze({
  idle: 'Schema checks have not run in this view.',
  loading: 'Checking database schema…',
  current: 'Schema checks completed. Migration records and critical schema checks are current.',
  attention: 'Schema checks completed. The database needs attention. Review the results below.',
  busy: 'A schema check or database preparation is already running. Refresh after it finishes.',
  unavailable: 'Schema checks are unavailable. Refresh to try again.',
  forbidden: 'Administrator access is required to view schema checks.',
  limited: 'Too many schema checks. Wait a minute, then refresh.',
});

export function projectSchemaDiagnosticsPayload(payload) {
  const report = payload?.schemaDiagnostics;
  if (['busy', 'unavailable'].includes(report?.state)) return { state: report.state };
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
