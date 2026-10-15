/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureFixtureWorkspaceOwner } from '../../testing/integration/fixture-workspace-owner.js';
import { createFixtureRuntimeLifetime } from '../../testing/integration/fixture-runtime-lifetime.js';

const observer = { measure: (_phase, operation) => operation() };
const guard = () => true;
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function fixture(work) {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-workspace-owner-')); const root = join(directory, 'owned'); await mkdir(root);
  try { await work({ directory, root, owner: await captureFixtureWorkspaceOwner(root) }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('runtime cleanup seals synchronously and drains the admitted database tail, preserving its own canonical completion', async () => {
  const lifetime = createFixtureRuntimeLifetime(); const entered = gate(); const held = gate(); let released = false;
  const pending = lifetime.run(async () => { entered.release(); await held.promise; return 'complete'; }); await entered.promise;
  const close = lifetime.close(async () => { released = true; }); assert.equal(lifetime.close(() => assert.fail()), close);
  await assert.rejects(lifetime.run(() => assert.fail()), { code: 'fixture_runtime_closed' }); assert.equal(released, false);
  held.release(); assert.equal(await pending, 'complete'); await close; assert.equal(released, true);
});

test('held guard completion precedes deletion and fresh same-name scenarios cannot alias one another', () => fixture(async ({ root, owner }) => {
  const entered = gate(); const held = gate(); let first;
  const pending = owner.withScenario({ name: 'same', observer, guard: async () => { entered.release(); return held.promise; } },
    async path => { first = path; return 'accepted'; });
  await entered.promise; await access(first); held.release(true); assert.equal(await pending, 'accepted');
  await assert.rejects(access(first), { code: 'ENOENT' });
  await owner.withScenario({ name: 'same', observer, guard }, async second => { assert.notEqual(second, first); });
  await owner.finish({ observer, guard, release: async () => {} }); await assert.rejects(access(root), { code: 'ENOENT' });
}));

for (const primary of [new Error('original-work'), null, undefined]) {
  test(`retained scenario and outer cleanup preserve ${primary === undefined ? 'refusal' : primary === null ? 'null' : 'Error'} through a failed release`, () => fixture(async ({ root, owner }) => {
    let first; let refused; let released = false;
    await assert.rejects(owner.withScenario({ name: 'same', observer, guard: () => false }, async path => {
      first = path; await writeFile(join(path, 'retained'), 'evidence'); if (primary !== undefined) throw primary;
    }), error => { refused = error; return primary === undefined ? error.code === 'fixture_workspace_not_quiescent' : error === primary; });
    await owner.withScenario({ name: 'same', observer, guard }, async second => { assert.notEqual(second, first); });
    await assert.rejects(owner.finish({ observer, guard, release: async () => { released = true; throw new Error('later-cleanup'); } }), error => error === refused);
    assert.equal(released, true); await access(join(first, 'retained')); await access(root);
  }));
}

test('intentional failed artifacts survive parent cleanup without adding a cleanup failure', () => fixture(async ({ owner, root }) => {
  let child;
  await assert.rejects(owner.withScenario({ name: 'artifact', observer, guard, keepArtifactsOnFailure: true }, path => { child = path; throw null; }), error => error === null);
  await owner.finish({ observer, guard, release: async () => {} }); await access(child); await access(root);
}));

test('thrown and truthy nonboolean guards never grant child or parent deletion', () => fixture(async ({ owner, root }) => {
  let child;
  await assert.rejects(owner.withScenario({ name: 'guarded', observer, guard: async () => { throw null; } }, path => { child = path; }), { code: 'fixture_workspace_not_quiescent' });
  await assert.rejects(owner.finish({ observer, guard, release: async () => {} }), { code: 'fixture_workspace_not_quiescent' }); await access(child);
  const separate = join(root, 'separate'); await mkdir(separate); const another = await captureFixtureWorkspaceOwner(separate);
  await assert.rejects(another.finish({ observer, guard: () => 'true', release: async () => {} }), { code: 'fixture_workspace_not_quiescent' }); await access(separate);
}));

for (const target of ['child', 'root', 'junction']) {
  test(`a replacement ${target} cannot inherit recursive deletion authority`, () => fixture(async ({ directory, root, owner }) => {
    let replacement;
    await assert.rejects(owner.withScenario({ name: 'replace', observer, guard }, async path => {
      if (target === 'root') { await rename(root, join(directory, 'original')); await mkdir(root); replacement = root; }
      else {
        await rename(path, join(root, 'original-child'));
        if (target === 'junction') {
          replacement = join(directory, 'outside'); await mkdir(replacement); await symlink(replacement, path, process.platform === 'win32' ? 'junction' : 'dir');
        } else { await mkdir(path); replacement = path; }
      }
      await writeFile(join(replacement, 'sentinel'), 'preserve');
    }), { code: 'fixture_workspace_not_quiescent' });
    await assert.rejects(owner.finish({ observer, guard, release: async () => {} }), { code: 'fixture_workspace_not_quiescent' });
    await access(join(replacement, 'sentinel'));
  }));
}
