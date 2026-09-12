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

import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import { useArtistMutationTask } from '../../src/client/composables/useArtistMutationTask.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(t) {
  const artist = ref('A');
  const actor = ref('operator');
  const owner = effectScope();
  t.after(() => owner.stop());
  const task = owner.run(() => useArtistMutationTask({
    getScope: () => ({ mbid: artist.value, actorId: actor.value }), fallbackMessage: 'Save failed',
  }));
  return { task, artist, actor, owner };
}

test('artist mutation ignores old success and finally while another artist is saving', async (t) => {
  const { task, artist } = setup(t);
  const old = deferred(), current = deferred();
  const applied = [];
  const a = task.run((scope) => { assert.equal(scope.mbid, 'A'); return old.promise; }, (result) => applied.push(result));
  artist.value = 'B';
  const b = task.run(() => current.promise, (result) => applied.push(result));
  old.resolve('old');
  assert.deepEqual(await a, { stale: true });
  assert.equal(task.isPending.value, true);
  assert.deepEqual(applied, []);
  current.resolve('current');
  assert.deepEqual(await b, { ok: true });
  assert.deepEqual(applied, ['current']);
  assert.equal(task.isPending.value, false);
});

test('A to B to A invalidates the original A session, including stale failures', async (t) => {
  const { task, artist } = setup(t);
  const old = deferred();
  const work = task.run(() => old.promise);
  artist.value = 'B';
  artist.value = 'A';
  old.reject(new Error('obsolete failure'));
  assert.deepEqual(await work, { stale: true });
  assert.equal(task.error.value, '');
  assert.equal(task.isPending.value, false);
});

test('actor change and disposal prevent reload, feedback, and follow-up work', async (t) => {
  for (const change of ['actor', 'dispose']) {
    const { task, actor, owner } = setup(t);
    const old = deferred();
    const applied = t.mock.fn();
    const work = task.run(() => old.promise, applied);
    if (change === 'actor') actor.value = 'another';
    else owner.stop();
    old.resolve({});
    assert.deepEqual(await work, { stale: true });
    assert.equal(applied.mock.callCount(), 0);
  }
});

test('same-session duplicates are suppressed and failed saves can retry', async (t) => {
  const { task } = setup(t);
  const pending = deferred();
  const submit = t.mock.fn(() => pending.promise);
  const work = task.run(submit);
  assert.deepEqual(await task.run(submit), { skipped: true });
  assert.equal(submit.mock.callCount(), 1);
  pending.reject(new Error('Try again'));
  assert.equal((await work).ok, false);
  assert.equal(task.error.value, 'Try again');
  assert.equal(task.isPending.value, false);
  assert.deepEqual(await task.run(async () => ({})), { ok: true });
  assert.equal(task.error.value, '');
});

test('invalidating during a follow-up reload prevents obsolete finally updates', async (t) => {
  const { task, artist } = setup(t);
  const followup = deferred(), next = deferred();
  const work = task.run(async () => ({}), () => followup.promise);
  await Promise.resolve();
  artist.value = 'B';
  const current = task.run(() => next.promise);
  followup.resolve();
  assert.deepEqual(await work, { stale: true });
  assert.equal(task.isPending.value, true);
  next.resolve();
  await current;
});
