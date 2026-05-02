/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadMigrationManifest } from '../src/server/migration-manifest.js';
import { schemaIdDefaultExpression, schemaIdFunctionName } from '../src/server/schema-id-function.js';
import { runDirectScriptTask } from './script-runtime.js';

const surrogateDefaultPattern = /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+([^,\s)]+\(\))/gi;

function collectInvalidDefaults({ content, label }) {
  const invalid = [];

  for (const match of content.matchAll(surrogateDefaultPattern)) {
    if (match[1] !== schemaIdDefaultExpression) {
      invalid.push(`${label}: invalid surrogate UUID default ${match[1]}`);
    }
  }

  return invalid;
}

async function checkMigrationIdPolicy() {
  const migrations = await loadMigrationManifest();
  const violations = [];
  const bootstrapMigration = migrations.find((migration) => migration.filename === '20260427_000001_bootstrap_core_tables.sql');

  if (!bootstrapMigration?.sql.includes(`CREATE OR REPLACE FUNCTION ${schemaIdFunctionName}()`)) {
    violations.push('bootstrap migration must define harmoniarr_generate_uuid() before later migrations use it');
  }

  for (const migration of migrations) {
    violations.push(...collectInvalidDefaults({
      content: migration.sql,
      label: migration.filename,
    }));
  }

  const schemaSnapshotPath = resolve(process.cwd(), 'src/server/schema-snapshot.sql');
  const schemaSnapshot = await readFile(schemaSnapshotPath, 'utf8');
  violations.push(...collectInvalidDefaults({
    content: schemaSnapshot,
    label: 'src/server/schema-snapshot.sql',
  }));

  if (violations.length > 0) {
    throw new Error(`Migration surrogate-key policy violations:\n${violations.map((item) => `- ${item}`).join('\n')}`);
  }
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-check-migration-id-policy',
  renderSuccessMessage: () => 'Migration surrogate-key defaults are valid.',
  run: checkMigrationIdPolicy,
});