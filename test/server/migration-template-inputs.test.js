/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { checksumSql, parseMigrationFilename } from '../../src/server/migration-manifest.js';
import { buildMigrationTemplateFingerprint, captureMigrationTemplateInputs, loadMigrationTemplateInputs }
  from '../../testing/integration/migration-template-inputs.js';

const migration = (filename, sql = 'SELECT 1;') => ({ ...parseMigrationFilename(filename), sql,
  path: `C:/first-workspace/${filename}`, checksum: checksumSql(sql) });
const inputs = () => ({ sourceFingerprint: 'a'.repeat(64), manifest: [migration('20261010_000000_first.sql'),
  migration('20261010_000001_second.sql', 'SELECT 2;')] });
const profile = () => ({ serverVersion: '180003', encoding: 'UTF8', localeProvider: 'c',
  collation: 'C.UTF-8', ctype: 'C.UTF-8', locale: null, icuRules: null });
const fingerprint = (value = inputs(), databaseProfile = profile()) => buildMigrationTemplateFingerprint({ inputs: value, databaseProfile });

test('the actual loader returns immutable ordered lineage and a repeatable fixed-source fingerprint', async () => {
  const first = await loadMigrationTemplateInputs(); const second = await loadMigrationTemplateInputs();
  assert.ok(first.manifest.length > 0); assert.match(first.sourceFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(first.sourceFingerprint, second.sourceFingerprint); assert.deepEqual(first.manifest, second.manifest);
  assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.manifest), true);
  assert.equal(first.manifest.every((entry) => Object.isFrozen(entry) && checksumSql(entry.sql) === entry.checksum), true);
});

test('fingerprints are deterministic across property order and workspace paths while retaining the same SQL lineage', () => {
  const original = inputs(); const relocated = structuredClone(original);
  relocated.manifest = relocated.manifest.map((entry) => Object.fromEntries(Object.entries({ ...entry,
    path: `D:/different-workspace/${entry.filename}` }).reverse()));
  const reorderedProfile = Object.fromEntries(Object.entries(profile()).reverse());
  assert.match(fingerprint(original), /^[a-f0-9]{64}$/u);
  assert.equal(fingerprint(original), fingerprint(relocated, reorderedProfile));
});

test('SQL lineage, fixed source bytes and every database profile field change the identity', () => {
  const original = inputs(); const expected = fingerprint(original);
  const changedSql = structuredClone(original); changedSql.manifest[1] = migration('20261010_000001_second.sql', 'SELECT 3;');
  const extended = structuredClone(original); extended.manifest.push(migration('20261010_000002_third.sql'));
  assert.notEqual(fingerprint(changedSql), expected); assert.notEqual(fingerprint(extended), expected);
  assert.notEqual(fingerprint({ ...original, sourceFingerprint: 'b'.repeat(64) }), expected);
  for (const key of Object.keys(profile())) {
    const changed = profile(); changed[key] = changed[key] === null ? 'explicit-value' : `${changed[key]}-changed`;
    assert.notEqual(fingerprint(original, changed), expected, key);
  }
  assert.notEqual(fingerprint(original, { ...profile(), icuRules: '' }), expected);
});

test('captured inputs cannot be changed through a caller-owned manifest after capture', () => {
  const original = inputs(); const captured = captureMigrationTemplateInputs(original);
  original.manifest[0].checksum = 'b'.repeat(64); original.manifest.pop();
  assert.equal(captured.manifest.length, 2); assert.equal(captured.manifest[0].checksum, checksumSql('SELECT 1;'));
});

test('malformed, ambiguous and relabelled input identities are refused', () => {
  const cases = [null, { ...inputs(), version: 2 }, { ...inputs(), mode: 'snapshot' },
    { ...inputs(), sourceFingerprint: 'not-a-hash' }, { ...inputs(), manifest: [] }];
  const wrongKey = inputs(); wrongKey.manifest[0].migrationKey = '20261010_999999'; cases.push(wrongKey);
  const wrongDescription = inputs(); wrongDescription.manifest[0].description = 'other'; cases.push(wrongDescription);
  const staleChecksum = inputs(); staleChecksum.manifest[0].sql = 'SELECT 99;'; cases.push(staleChecksum);
  const duplicate = inputs(); duplicate.manifest[1] = { ...duplicate.manifest[0] }; cases.push(duplicate);
  const duplicateKey = inputs(); duplicateKey.manifest = [migration('20261010_000000_alpha.sql'), migration('20261010_000000_beta.sql')];
  cases.push(duplicateKey);
  const unordered = inputs(); unordered.manifest.reverse(); cases.push(unordered);
  for (const value of cases) assert.throws(() => fingerprint(value), TypeError);
});

test('database profile requires the complete typed DTO without ignored labels or values', () => {
  const missing = profile(); delete missing.icuRules;
  for (const value of [null, missing, { ...profile(), version: 1 }, { ...profile(), serverVersion: 180003 },
    { ...profile(), encoding: '' }, { ...profile(), localeProvider: false }, { ...profile(), icuRules: undefined }]) {
    assert.throws(() => fingerprint(inputs(), value), TypeError);
  }
});

test('caller labels cannot change or impersonate the fixed migration-only input protocol', async () => {
  await assert.rejects(loadMigrationTemplateInputs({ mode: 'snapshot' }), TypeError);
  assert.throws(() => buildMigrationTemplateFingerprint({ inputs: inputs(), databaseProfile: profile(), mode: 'snapshot' }), TypeError);
  assert.throws(() => buildMigrationTemplateFingerprint({ inputs: inputs(), databaseProfile: profile(), version: 2 }), TypeError);
});
