/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';
import { validatePostgresRecovery } from './postgres-recovery-validation.js';

export const postgresRecoveryHelp = 'Usage: node scripts/validate-postgres-recovery.js --evidence-path <new-json-file>\nCreates an isolated PostgreSQL 18 fixture, verifies a real dump/restore, and removes its container. No production database, existing archive, or deployment credentials are accepted.';

export function parsePostgresRecoveryOptions(args = process.argv.slice(2)) {
  let values;
  try { ({ values } = parseStrictScriptOptions({ help: { type: 'boolean' }, 'evidence-path': { type: 'string' } }, { args })); }
  catch { throw new Error('Unsupported PostgreSQL rehearsal options; use --help'); }
  if (values.help) return { help: true };
  if (typeof values['evidence-path'] !== 'string' || !values['evidence-path'].trim()) throw new Error('--evidence-path is required');
  return { evidencePath: values['evidence-path'] };
}

export async function runPostgresRecoveryCommand({ args = process.argv.slice(2), validate = validatePostgresRecovery } = {}) {
  const options = parsePostgresRecoveryOptions(args);
  if (options.help) return { help: true };
  let output;
  try {
    await mkdir(dirname(options.evidencePath), { recursive: true });
    output = await open(options.evidencePath, 'wx', 0o600);
  } catch { throw new Error('Select a new writable PostgreSQL rehearsal evidence file'); }
  let result;
  let failure;
  try {
    const evidence = await validate();
    await output.writeFile(`${JSON.stringify(evidence, null, 2)}\n`);
    result = evidence;
  } catch (error) {
    // An interrupted or failed run leaves an empty reserved file, never a pass.
    failure = error?.code === 'postgres_recovery_rehearsal_failed' ? error : new Error('PostgreSQL recovery rehearsal or evidence writing failed');
  } finally {
    try { await output.close(); } catch { failure = new Error('PostgreSQL recovery evidence file could not be closed'); }
  }
  if (failure) throw failure;
  return result;
}

await runDirectScriptTask(import.meta, {
  prefix: 'postgres-recovery', run: () => runPostgresRecoveryCommand(),
  renderSuccessMessage: (result) => result.help ? postgresRecoveryHelp : 'Isolated PostgreSQL recovery rehearsal passed; sanitized evidence saved and owned container removed',
});
