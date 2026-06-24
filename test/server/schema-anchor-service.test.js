import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSchemaAnchorComparisonClean,
  compareSchemaAnchorSnapshots,
  criticalSchemaAnchors,
  inspectSchemaAnchors,
} from '../../src/server/schema-anchor-service.js';

const anchors = {
  columns: [{ table: 'operation_runs', column: 'status' }],
  constraints: [{ table: 'operation_runs', constraint: 'operation_runs_pkey' }],
  indexes: [{ index: 'operation_runs_pending_dispatch_idx' }],
  tables: [{ table: 'operation_runs' }],
};

function buildClient(rowsByPattern) {
  return {
    query: async (sql) => {
      for (const [pattern, rows] of rowsByPattern) {
        if (pattern.test(sql)) {
          return { rows };
        }
      }

      return { rows: [] };
    },
  };
}

test('inspectSchemaAnchors collects table, column, constraint, and index metadata', async () => {
  const snapshot = await inspectSchemaAnchors({
    anchors,
    client: buildClient([
      [/information_schema\.tables/, [{ table_name: 'operation_runs', table_type: 'BASE TABLE' }]],
      [/information_schema\.columns/, [{
        column_default: null,
        column_name: 'status',
        data_type: 'text',
        is_nullable: 'NO',
        table_name: 'operation_runs',
        udt_name: 'text',
      }]],
      [/information_schema\.table_constraints/, [{
        constraint_name: 'operation_runs_pkey',
        constraint_type: 'PRIMARY KEY',
        initially_deferred: 'NO',
        is_deferrable: 'NO',
        table_name: 'operation_runs',
      }]],
      [/pg_indexes/, [{
        indexdef: 'CREATE INDEX operation_runs_pending_dispatch_idx ON public.operation_runs USING btree (next_attempt_at)',
        indexname: 'operation_runs_pending_dispatch_idx',
        tablename: 'operation_runs',
      }]],
    ]),
  });

  assert.equal(snapshot.tables['table.operation_runs'].actual.tableType, 'BASE TABLE');
  assert.equal(snapshot.columns['column.operation_runs.status'].actual.dataType, 'text');
  assert.equal(snapshot.constraints['constraint.operation_runs.operation_runs_pkey'].actual.constraintType, 'PRIMARY KEY');
  assert.match(
    snapshot.indexes['index.operation_runs_pending_dispatch_idx'].actual.indexDefinition,
    /CREATE INDEX operation_runs_pending_dispatch_idx/,
  );
});

test('critical schema anchors include operation run lookup index', () => {
  assert.deepEqual(
    criticalSchemaAnchors.indexes.find((anchor) => anchor.index === 'operation_runs_type_started_idx'),
    { index: 'operation_runs_type_started_idx' },
  );
});

test('critical schema anchors include per-operator wanted state anchors', () => {
  assert.deepEqual(
    criticalSchemaAnchors.tables.find((anchor) => anchor.table === 'library_wanted_releases'),
    { table: 'library_wanted_releases' },
  );
  assert.deepEqual(
    criticalSchemaAnchors.columns.find((anchor) => (
      anchor.table === 'library_wanted_releases' && anchor.column === 'app_user_id'
    )),
    { table: 'library_wanted_releases', column: 'app_user_id' },
  );
  assert.deepEqual(
    criticalSchemaAnchors.constraints.find((anchor) => (
      anchor.table === 'library_wanted_releases'
      && anchor.constraint === 'library_wanted_releases_user_release_unique'
    )),
    { table: 'library_wanted_releases', constraint: 'library_wanted_releases_user_release_unique' },
  );
});

test('compareSchemaAnchorSnapshots reports clean matching anchors', () => {
  const source = {
    columns: {
      'column.operation_runs.status': { actual: { dataType: 'text' } },
    },
    constraints: {},
    indexes: {},
    tables: {
      'table.operation_runs': { actual: { tableType: 'BASE TABLE' } },
    },
  };
  const snapshot = structuredClone(source);

  const comparison = compareSchemaAnchorSnapshots({ snapshot, source });

  assert.equal(comparison.clean, true);
  assert.equal(comparison.anchorCount, 2);
  assert.doesNotThrow(() => assertSchemaAnchorComparisonClean(comparison));
});

test('assertSchemaAnchorComparisonClean reports source, snapshot, and mismatch failures', () => {
  const comparison = compareSchemaAnchorSnapshots({
    source: {
      columns: {
        'column.operation_runs.status': { actual: null },
        'column.media_requests.request_state': { actual: { dataType: 'text' } },
        'column.schema_migrations.filename': { actual: { dataType: 'text' } },
      },
      constraints: {},
      indexes: {},
      tables: {},
    },
    snapshot: {
      columns: {
        'column.operation_runs.status': { actual: { dataType: 'text' } },
        'column.media_requests.request_state': { actual: null },
        'column.schema_migrations.filename': { actual: { dataType: 'uuid' } },
      },
      constraints: {},
      indexes: {},
      tables: {},
    },
  });

  assert.equal(comparison.clean, false);
  assert.deepEqual(comparison.sourceMissing, ['columns:column.operation_runs.status']);
  assert.deepEqual(comparison.snapshotMissing, ['columns:column.media_requests.request_state']);
  assert.equal(comparison.mismatches.length, 3);

  assert.throws(
    () => assertSchemaAnchorComparisonClean(comparison),
    /Critical schema anchors do not match[\s\S]*Source database missing anchors[\s\S]*Snapshot bootstrap missing anchors[\s\S]*Schema anchor mismatches/,
  );
});
