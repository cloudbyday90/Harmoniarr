/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildDatabaseMigrationStateReport } from './schema-migration-state-service.js';

export function summarizeObservedLineage({ observation, repoMigrations }) {
  const expectedRows = repoMigrations.length, observedRows = observation.rows.length;
  if (!observation.present) return { state: 'unavailable', reason: 'ledger_unavailable', expectedRows, observedRows: 0 };
  if (observedRows > expectedRows) return { state: 'not_current', reason: 'row_limit_exceeded', expectedRows, observedRows };
  const report = buildDatabaseMigrationStateReport({ databaseRows: observation.rows, repoMigrations });
  return { state: report.current && observedRows === expectedRows ? 'current' : 'not_current', expectedRows, observedRows,
    pendingCount: report.pending.length, unknownAppliedCount: report.unknownApplied.length,
    checksumDriftCount: report.checksumDrift.length, migrationKeyDriftCount: report.migrationKeyDrift.length,
    nonAppliedCount: report.nonAppliedRows.length };
}

export function formatSchemaDriftDiagnostics(report) {
  const lines = [`Schema diagnostics: ${report.current ? 'current' : 'attention'}`,
    `Migration lineage: ${report.lineage.state} (${report.lineage.observedRows} observed, ${report.lineage.expectedRows} expected)`,
    `Critical anchors: ${report.anchors.state} (${report.anchors.checkedCount} checked, ${report.anchors.missing.length} missing, ${report.anchors.altered.length} altered)`];
  if (report.lineage.reason === 'row_limit_exceeded') lines.push('Lineage row limit exceeded; observed rows are a bounded prefix, not a complete count.');
  else if (report.lineage.state === 'unavailable') lines.push('The public migration ledger is unavailable.');
  else lines.push(`Lineage differences: ${report.lineage.pendingCount} pending, ${report.lineage.unknownAppliedCount} unknown applied, ${report.lineage.checksumDriftCount} checksum drift, ${report.lineage.migrationKeyDriftCount} key drift, ${report.lineage.nonAppliedCount} non-applied`);
  for (const kind of ['missing', 'altered']) if (report.anchors[kind].length) lines.push(`${kind === 'missing' ? 'Missing' : 'Altered'} anchors: ${report.anchors[kind].join(', ')}`);
  lines.push('Observation only; no schema or migration repair was attempted.');
  return lines.join('\n');
}
