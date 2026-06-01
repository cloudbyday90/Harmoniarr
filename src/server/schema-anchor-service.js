/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const publicSchema = 'public';

export const criticalSchemaAnchors = Object.freeze({
  columns: Object.freeze([
    { table: 'schema_migrations', column: 'filename' },
    { table: 'schema_migrations', column: 'checksum' },
    { table: 'schema_migrations', column: 'status' },
    { table: 'operation_runs', column: 'operation_type' },
    { table: 'operation_runs', column: 'status' },
    { table: 'operation_runs', column: 'summary' },
    { table: 'media_requests', column: 'requested_by_user_id' },
    { table: 'media_requests', column: 'requested_for_user_id' },
    { table: 'media_requests', column: 'request_state' },
    { table: 'media_requests', column: 'matched_metadata_release_id' },
    { table: 'media_requests', column: 'linked_request_id' },
    { table: 'operator_artist_monitoring', column: 'app_user_id' },
    { table: 'operator_artist_monitoring', column: 'metadata_artist_id' },
    { table: 'operator_artist_monitoring', column: 'release_scope' },
    { table: 'operator_artist_monitoring', column: 'wanted_automation_mode' },
    { table: 'operator_release_group_selection', column: 'selection_state' },
    { table: 'operator_track_override', column: 'is_desired' },
    { table: 'operator_track_override', column: 'remap_status' },
    { table: 'operator_track_override', column: 'track_mbid' },
    { table: 'operator_artist_reconciliation_snapshot', column: 'snapshot_revision' },
    { table: 'operator_artist_reconciliation_snapshot', column: 'snapshot_payload' },
    { table: 'library_files', column: 'tag_extracted_size_bytes' },
    { table: 'library_files', column: 'tag_extracted_modified_at' },
  ]),
  constraints: Object.freeze([
    { table: 'schema_migrations', constraint: 'schema_migrations_filename_key' },
    { table: 'operation_runs', constraint: 'operation_runs_pkey' },
    { table: 'media_requests', constraint: 'media_requests_state_check' },
    { table: 'media_requests', constraint: 'media_requests_requested_for_user_id_fkey' },
    { table: 'operator_artist_monitoring', constraint: 'operator_artist_monitoring_user_artist_unique' },
    { table: 'operator_artist_monitoring', constraint: 'operator_artist_monitoring_release_scope_check' },
    { table: 'operator_artist_monitoring', constraint: 'operator_artist_monitoring_wanted_automation_mode_check' },
    { table: 'operator_track_override', constraint: 'operator_track_override_identity_check' },
    { table: 'operator_track_override', constraint: 'operator_track_override_remap_status_check' },
    { table: 'operator_artist_reconciliation_snapshot', constraint: 'operator_artist_reconciliation_snapshot_revision_unique' },
    { table: 'operator_artist_reconciliation_snapshot', constraint: 'operator_artist_reconciliation_snapshot_payload_object_check' },
  ]),
  indexes: Object.freeze([
    { index: 'operation_runs_pending_dispatch_idx' },
    { index: 'operation_runs_running_recovery_idx' },
    { index: 'operation_runs_operator_artist_reconciliation_pending_unique_idx' },
    { index: 'operation_runs_operator_artist_reconciliation_running_unique_idx' },
    { index: 'media_requests_requested_for_user_created_at_idx' },
    { index: 'media_requests_musicbrainz_release_id_idx' },
    { index: 'idx_media_requests_created_at_id_desc' },
    { index: 'operator_artist_monitoring_user_monitored_idx' },
    { index: 'operator_artist_monitoring_artist_idx' },
    { index: 'operator_track_override_artist_lookup_idx' },
    { index: 'operator_track_override_track_mbid_unique' },
    { index: 'operator_track_override_recording_fallback_unique' },
    { index: 'operator_artist_reconciliation_snapshot_latest_idx' },
  ]),
  tables: Object.freeze([
    { table: 'schema_migrations' },
    { table: 'operation_runs' },
    { table: 'media_requests' },
    { table: 'operator_artist_monitoring' },
    { table: 'operator_release_group_selection' },
    { table: 'operator_track_override' },
    { table: 'operator_artist_reconciliation_snapshot' },
    { table: 'library_files' },
  ]),
});

function anchorKey(parts) {
  return parts.filter(Boolean).join('.');
}

function normalizeSqlDefinition(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeColumn(row) {
  if (!row) return null;

  return {
    columnDefault: normalizeSqlDefinition(row.column_default),
    columnName: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable,
    tableName: row.table_name,
    udtName: row.udt_name,
  };
}

function normalizeConstraint(row) {
  if (!row) return null;

  return {
    constraintName: row.constraint_name,
    constraintType: row.constraint_type,
    initiallyDeferred: row.initially_deferred,
    isDeferrable: row.is_deferrable,
    tableName: row.table_name,
  };
}

function normalizeIndex(row) {
  if (!row) return null;

  return {
    indexDefinition: normalizeSqlDefinition(row.indexdef),
    indexName: row.indexname,
    tableName: row.tablename,
  };
}

function normalizeTable(row) {
  if (!row) return null;

  return {
    tableName: row.table_name,
    tableType: row.table_type,
  };
}

function buildAnchorRecordMap(entries, buildKey) {
  return Object.fromEntries(entries.map((entry) => [buildKey(entry), entry]));
}

async function fetchOne(client, sql, values) {
  const result = await client.query(sql, values);
  return result.rows[0] ?? null;
}

export async function inspectSchemaAnchors({
  anchors = criticalSchemaAnchors,
  client,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('client is required');
  }

  const tables = [];
  for (const anchor of anchors.tables ?? []) {
    const row = await fetchOne(
      client,
      `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
      `,
      [publicSchema, anchor.table],
    );
    tables.push({ anchor, actual: normalizeTable(row) });
  }

  const columns = [];
  for (const anchor of anchors.columns ?? []) {
    const row = await fetchOne(
      client,
      `
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
      `,
      [publicSchema, anchor.table, anchor.column],
    );
    columns.push({ anchor, actual: normalizeColumn(row) });
  }

  const constraints = [];
  for (const anchor of anchors.constraints ?? []) {
    const row = await fetchOne(
      client,
      `
        SELECT table_name, constraint_name, constraint_type, is_deferrable, initially_deferred
        FROM information_schema.table_constraints
        WHERE table_schema = $1
          AND table_name = $2
          AND constraint_name = $3
      `,
      [publicSchema, anchor.table, anchor.constraint],
    );
    constraints.push({ anchor, actual: normalizeConstraint(row) });
  }

  const indexes = [];
  for (const anchor of anchors.indexes ?? []) {
    const row = await fetchOne(
      client,
      `
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1
          AND indexname = $2
      `,
      [publicSchema, anchor.index],
    );
    indexes.push({ anchor, actual: normalizeIndex(row) });
  }

  return {
    columns: buildAnchorRecordMap(columns, ({ anchor }) => anchorKey(['column', anchor.table, anchor.column])),
    constraints: buildAnchorRecordMap(constraints, ({ anchor }) => anchorKey(['constraint', anchor.table, anchor.constraint])),
    indexes: buildAnchorRecordMap(indexes, ({ anchor }) => anchorKey(['index', anchor.index])),
    tables: buildAnchorRecordMap(tables, ({ anchor }) => anchorKey(['table', anchor.table])),
  };
}

function collectMissingAnchors(snapshot) {
  const missing = [];

  for (const groupName of ['tables', 'columns', 'constraints', 'indexes']) {
    for (const [key, record] of Object.entries(snapshot[groupName] ?? {})) {
      if (!record.actual) {
        missing.push(`${groupName}:${key}`);
      }
    }
  }

  return missing;
}

function collectAnchorMismatches(left, right) {
  const mismatches = [];

  for (const groupName of ['tables', 'columns', 'constraints', 'indexes']) {
    const leftGroup = left[groupName] ?? {};
    const rightGroup = right[groupName] ?? {};
    const keys = new Set([...Object.keys(leftGroup), ...Object.keys(rightGroup)]);

    for (const key of keys) {
      const leftValue = leftGroup[key]?.actual ?? null;
      const rightValue = rightGroup[key]?.actual ?? null;
      if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        mismatches.push({
          group: groupName,
          key,
          source: leftValue,
          snapshot: rightValue,
        });
      }
    }
  }

  return mismatches;
}

export function compareSchemaAnchorSnapshots({ source, snapshot }) {
  const sourceMissing = collectMissingAnchors(source);
  const snapshotMissing = collectMissingAnchors(snapshot);
  const mismatches = collectAnchorMismatches(source, snapshot);

  return {
    anchorCount: Object.values(source).reduce((count, group) => count + Object.keys(group).length, 0),
    clean: sourceMissing.length === 0 && snapshotMissing.length === 0 && mismatches.length === 0,
    mismatches,
    snapshotMissing,
    sourceMissing,
  };
}

export function assertSchemaAnchorComparisonClean(comparison) {
  if (comparison.clean) {
    return comparison;
  }

  const details = [];
  if (comparison.sourceMissing.length > 0) {
    details.push(`Source database missing anchors: ${comparison.sourceMissing.join(', ')}`);
  }

  if (comparison.snapshotMissing.length > 0) {
    details.push(`Snapshot bootstrap missing anchors: ${comparison.snapshotMissing.join(', ')}`);
  }

  if (comparison.mismatches.length > 0) {
    details.push(`Schema anchor mismatches: ${comparison.mismatches
      .map((entry) => `${entry.group}:${entry.key}`)
      .join(', ')}`);
  }

  throw new Error([
    'Critical schema anchors do not match between the source database and committed snapshot bootstrap.',
    ...details,
  ].join('\n'));
}
