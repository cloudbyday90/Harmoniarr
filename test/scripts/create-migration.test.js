import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../../scripts/create-migration.js', import.meta.url));

async function withTempDir(run) {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'harmoniarr-migration-'));

  try {
    return await run(tempDir);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

test('create-migration writes a filename to stdout without a prefix', async () => {
  await withTempDir(async (tempDir) => {
    const result = spawnSync(process.execPath, [scriptPath, 'Add library catalog'], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^\d{8}_\d{6}_add_library_catalog\.sql\n$/);

    const filename = result.stdout.trim();
    const content = await readFile(resolve(tempDir, 'src/server/migrations', filename), 'utf8');
    assert.equal(content, '-- forward-only migration\nBEGIN;\n\nCOMMIT;\n');
  });
});

test('create-migration reports usage failures through the shared runtime', async () => {
  await withTempDir(async (tempDir) => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^\[harmoniarr-create-migration\] Usage: npm run migration:create -- <description>\n$/);
  });
});