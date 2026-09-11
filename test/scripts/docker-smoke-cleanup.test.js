import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertDockerProjectRemoved, cleanupDockerSmokeWorkspace,
  removeOwnedDockerWorkspace } from '../../scripts/docker-smoke-cleanup.js';

test('strict cleanup proves absence of stopped containers, networks, and volumes before deleting bind data', async (t) => {
  const tempRootDir = await mkdtemp(resolve(tmpdir(), 'smoke-cleanup-test-'));
  t.after(() => rm(tempRootDir, { recursive: true, force: true }));
  const workspaceRoot = await mkdtemp(resolve(tempRootDir, 'harmoniarr-docker-smoke-'));
  const calls = [];
  await cleanupDockerSmokeWorkspace({ projectName: 'owned-project', strictCleanup: true, tempRootDir, workspaceRoot,
    workspacePrefix: 'harmoniarr-docker-smoke-', stopProjectFn: async () => { calls.push('down'); },
    runCommandFn: async ({ args }) => { calls.push(args[0]); assert.ok(args.includes('label=com.docker.compose.project=owned-project'));
      assert.ok((await stat(workspaceRoot)).isDirectory()); return { exitCode: 0, stdout: '' }; },
  });
  assert.deepEqual(calls, ['down', 'container', 'network', 'volume']);
  await assert.rejects(stat(workspaceRoot), { code: 'ENOENT' });
});

test('strict cleanup fails and keeps bind data after down or resource verification failure', async () => {
  for (const stage of ['down', 'container', 'network', 'volume']) {
    let removed = false;
    await assert.rejects(cleanupDockerSmokeWorkspace({ projectName: 'owned-project', strictCleanup: true,
      workspaceRoot: '/unused', tempRootDir: '/unused', workspacePrefix: 'unused',
      removeFn: async () => { removed = true; },
      stopProjectFn: async () => { if (stage === 'down') throw new Error('private raw command'); },
      runCommandFn: async ({ args }) => ({ exitCode: 0, stdout: args[0] === stage ? 'remaining-owned-resource' : '' }),
    }), /^Error: Owned Docker acceptance resource cleanup could not be verified$/);
    assert.equal(removed, false);
  }
});

test('owned workspace removal rejects paths outside its temp parent and verifies removal actually happened', async (t) => {
  const tempRootDir = await mkdtemp(resolve(tmpdir(), 'smoke-cleanup-test-'));
  t.after(() => rm(tempRootDir, { recursive: true, force: true }));
  const workspaceRoot = await mkdtemp(resolve(tempRootDir, 'harmoniarr-docker-smoke-'));
  await assert.rejects(removeOwnedDockerWorkspace({ workspaceRoot: tempRootDir, tempRootDir, prefix: 'smoke' }), /ownership could not be verified/);
  await assert.rejects(removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir, prefix: 'harmoniarr-docker-smoke-',
    removeFn: async () => {},
  }), /workspace cleanup could not be verified/);
  await assert.rejects(assertDockerProjectRemoved({ projectName: 'unsafe * filter', runCommandFn: async () => {} }), /project identity is invalid/);
});
