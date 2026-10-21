/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createManualHistoryController } from '../../testing/manual/metadata-history-controller.js';

test('manual history pages replay by cursor with distinct continuing/final entries', async () => {
  const control = createManualHistoryController();
  const continuing = await control.readPage({ before: 'initial-cursor' });
  assert.equal(continuing.entries.length, 10); assert.deepEqual(continuing.pageInfo, { hasMore: true, nextCursor: 'final-cursor' });
  assert.deepEqual(await control.readPage({ before: 'initial-cursor' }), continuing);
  const final = await control.readPage({ before: 'final-cursor' });
  assert.equal(final.entries.length, 1); assert.deepEqual(final.pageInfo, { hasMore: false, nextCursor: null });
  assert.equal(new Set([...continuing.entries, ...final.entries].map(row => row.id)).size, 11);
  await control.close();
});

test('manual read stays pending until terminal release and refuses a competing held read', async t => {
  const control = createManualHistoryController(); t.after(() => control.close());
  control.command('hold'); let returned = false;
  const read = control.readPage({ before: 'initial-cursor' }).then(value => { returned = true; return value; });
  assert.equal(control.status().pending, true);
  await assert.rejects(control.readPage({ before: 'initial-cursor' }), { status: 409 });
  assert.equal(returned, false); assert.throws(() => control.command('reset'), /held read/u);
  control.command('release'); assert.equal((await read).entries.length, 10);
  assert.deepEqual(control.status(), { next: 'ready', pending: false, closed: false, reads: 1 });
});

test('controlled failure applies once to the held or next read and retry retains its page', async () => {
  for (const held of [false, true]) {
    const control = createManualHistoryController();
    if (held) control.command('hold'); else control.command('fail');
    const failed = control.readPage({ before: 'initial-cursor' });
    if (held) control.command('fail');
    await assert.rejects(failed, { status: 503, code: 'manual_history_unavailable' });
    assert.equal((await control.readPage({ before: 'initial-cursor' })).entries.length, 10);
    control.command('reset'); assert.deepEqual(control.status(), { next: 'ready', pending: false, closed: false, reads: 0 });
    await control.close();
  }
});

test('retirement rejects and drains a held read and seals further admission', async () => {
  const control = createManualHistoryController(); control.command('hold');
  const held = control.readPage({ before: 'final-cursor' });
  const refused = assert.rejects(held, { code: 'manual_history_unavailable' });
  await control.close(); await refused;
  await assert.rejects(control.readPage({ before: 'initial-cursor' }), { status: 503 });
  assert.throws(() => control.command('hold'), { status: 503 });
  assert.equal(control.status().pending, false); await control.close();
});

test('unknown cursor and terminal controls refuse without consuming the next fault', async () => {
  const control = createManualHistoryController(); control.command('fail');
  await assert.rejects(control.readPage({ before: 'invented' }), { status: 400 });
  assert.equal(control.status().next, 'fail'); assert.equal(control.status().reads, 0);
  assert.throws(() => control.command('release'), /No history read/u);
  assert.throws(() => control.command('invented'), /Use status/u); await control.close();
});
