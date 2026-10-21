import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../../scripts/create-migration.js', import.meta.url));
const copyrightCheckPath = fileURLToPath(new URL('../../scripts/check-copyright.js', import.meta.url));
const filenameCheckPath = fileURLToPath(new URL('../../scripts/check-migration-filenames.js', import.meta.url));

async function withTempDir(run) {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'harmoniarr-migration-'));

  try {
    return await run(tempDir);
  } finally {
    assert.equal(dirname(tempDir), resolve(tmpdir()));
    assert.equal(basename(tempDir).startsWith('harmoniarr-migration-'), true);
    await rm(tempDir, { force: true, recursive: true });
  }
}

test('create-migration produces policy-compliant SQL and filename-only stdout in a disposable checkout', async () => {
  await withTempDir(async (tempDir) => {
    const result = spawnSync(process.execPath, [scriptPath, '../../Add library catalog'], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^\d{8}_\d{6}_add_library_catalog\.sql\n$/);

    const filename = result.stdout.trim();
    const content = await readFile(resolve(tempDir, 'src/server/migrations', filename), 'utf8');
    assert.equal(content.endsWith('-- forward-only migration\nBEGIN;\n\n-- Use DEFAULT harmoniarr_generate_uuid() for UUID surrogate primary keys.\n\nCOMMIT;\n'), true);
    assert.deepEqual(await readdir(tempDir), ['src']);
    assert.deepEqual(await readdir(resolve(tempDir, 'src/server/migrations')), [filename]);

    for (const checkPath of [copyrightCheckPath, filenameCheckPath]) {
      const check = spawnSync(process.execPath, [checkPath], { cwd: tempDir, encoding: 'utf8' });
      assert.equal(check.status, 0, check.stderr);
      assert.equal(check.signal, null);
      assert.equal(check.stderr, '');
    }
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
