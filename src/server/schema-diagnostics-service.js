/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { inspectDatabaseSchemaDrift } from './schema-drift-service.js';

export function unavailableSchemaDiagnostics(state = 'unavailable') {
  return { state, checkedAt: null, lineage: null, anchors: null };
}

/** Explicit field projection for the administrator HTTP summary. No raw diagnostic details. */
export function projectSchemaDiagnostics(report, checkedAt) {
  const { lineage, anchors } = report;
  if (!['current', 'not_current', 'unavailable'].includes(lineage?.state)
    || !['current', 'drift'].includes(anchors?.state) || !Array.isArray(anchors.missing) || !Array.isArray(anchors.altered)) throw new Error('Invalid schema observation');
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (count(anchors.checkedCount) === null || anchors.checkedCount < 1 || count(lineage.expectedRows) === null
    || count(lineage.observedRows) === null || anchors.missing.length + anchors.altered.length > anchors.checkedCount) throw new Error('Invalid schema observation counts');
  if (report.current === true && (lineage.expectedRows < 1 || lineage.observedRows !== lineage.expectedRows
    || anchors.missing.length || anchors.altered.length)) throw new Error('Inconsistent schema observation');
  return { state: report.current === true && lineage.state === 'current' && anchors.state === 'current' ? 'current' : 'attention', checkedAt,
    lineage: { state: lineage.state, expectedRows: count(lineage.expectedRows), observedRows: count(lineage.observedRows),
      incomplete: lineage.reason === 'row_limit_exceeded', pendingCount: count(lineage.pendingCount),
      unknownAppliedCount: count(lineage.unknownAppliedCount), checksumDriftCount: count(lineage.checksumDriftCount),
      migrationKeyDriftCount: count(lineage.migrationKeyDriftCount), nonAppliedCount: count(lineage.nonAppliedCount) },
    anchors: { state: anchors.state, checkedCount: count(anchors.checkedCount), missingCount: anchors.missing.length, alteredCount: anchors.altered.length } };
}

export function createSchemaDiagnosticsService({ inspectFn = inspectDatabaseSchemaDrift, now = () => new Date() } = {}) {
  let running = false;
  return { async getSchemaDiagnostics() {
    if (running) return unavailableSchemaDiagnostics('busy');
    running = true;
    try { return projectSchemaDiagnostics(await inspectFn(), now().toISOString()); }
    catch (error) { return unavailableSchemaDiagnostics(error?.code === 'schema_observation_busy' ? 'busy' : 'unavailable'); }
    finally { running = false; }
  } };
}
