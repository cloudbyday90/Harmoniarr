import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../../scripts/check-migration-id-policy.js', import.meta.url));

async function withTempDir(run) {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'harmoniarr-migration-policy-'));

  try {
    return await run(tempDir);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function writeFixture(tempDir, { migrationSql, snapshotSql = migrationSql }) {
  const migrationDir = resolve(tempDir, 'src/server/migrations');
  await mkdir(migrationDir, { recursive: true });
  await writeFile(resolve(migrationDir, '20260427_000001_bootstrap_core_tables.sql'), migrationSql, 'utf8');
  await writeFile(resolve(tempDir, 'src/server/schema-snapshot.sql'), snapshotSql, 'utf8');
}

test('check-migration-id-policy accepts shared surrogate UUID defaults', async () => {
  await withTempDir(async (tempDir) => {
    await writeFixture(tempDir, {
      migrationSql: `CREATE OR REPLACE FUNCTION harmoniarr_generate_uuid()\nRETURNS UUID\nLANGUAGE SQL\nAS $$ SELECT gen_random_uuid(); $$;\n\nCREATE TABLE demo (\n  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid()\n);\n`,
    });

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Migration surrogate-key defaults are valid/);
  });
});

test('check-migration-id-policy rejects direct random UUID defaults', async () => {
  await withTempDir(async (tempDir) => {
    await writeFixture(tempDir, {
      migrationSql: `CREATE OR REPLACE FUNCTION harmoniarr_generate_uuid()\nRETURNS UUID\nLANGUAGE SQL\nAS $$ SELECT gen_random_uuid(); $$;\n\nCREATE TABLE demo (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid()\n);\n`,
      snapshotSql: 'CREATE TABLE demo (id UUID PRIMARY KEY DEFAULT gen_random_uuid());\n',
    });

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Migration surrogate-key policy violations/);
    assert.match(result.stderr, /invalid surrogate UUID default gen_random_uuid\(\)/);
  });
});