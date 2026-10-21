/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { historyPage } from '../browser/metadata-history-data.js';

const unavailable = () => Object.assign(new Error('Controlled manual history failure. Retry this read.'), { status: 503, code: 'manual_history_unavailable' });

/** Synthetic cursor pages and terminal-only fault controls; no provider or database work. */
export function createManualHistoryController() {
  let next = 'ready'; let pending = null; let closed = false; let reads = 0;
  const active = new Set();
  const status = () => ({ next, pending: pending !== null, closed, reads });
  function assertOpen() { if (closed) throw unavailable(); }
  function settle(error) {
    if (!pending) throw new Error('No history read is held.');
    const gate = pending; pending = null;
    if (error) gate.reject(error); else gate.resolve();
  }
  function readPage({ before }) {
    const operation = (async () => {
      assertOpen();
      if (!['initial-cursor', 'final-cursor'].includes(before)) throw Object.assign(new Error('Unknown manual history cursor.'), { status: 400 });
      if (pending) throw Object.assign(new Error('A manual history read is already held.'), { status: 409 });
      reads++;
      const mode = next; next = 'ready';
      if (mode === 'fail') throw unavailable();
      if (mode === 'hold') {
        const gate = Promise.withResolvers(); pending = gate;
        await gate.promise;
      }
      assertOpen();
      const page = historyPage(before === 'initial-cursor' ? 10 : 1, before === 'initial-cursor', before === 'initial-cursor' ? 'Continuing' : 'Final');
      if (page.pageInfo.hasMore) page.pageInfo.nextCursor = 'final-cursor';
      return page;
    })();
    active.add(operation);
    operation.then(() => active.delete(operation), () => active.delete(operation));
    return operation;
  }
  function command(name) {
    assertOpen();
    if (name === 'status') return status();
    if (name === 'release') { settle(); return status(); }
    if (name === 'fail' && pending) { settle(unavailable()); return status(); }
    if (!['hold', 'fail', 'reset'].includes(name)) throw new Error('Use status, hold, release, fail, reset or quit.');
    if (pending) throw new Error('Release or fail the held read before changing the next read.');
    next = name === 'reset' ? 'ready' : name;
    if (name === 'reset') reads = 0;
    return status();
  }
  async function close() {
    closed = true;
    if (pending) settle(unavailable());
    await Promise.allSettled([...active]);
  }
  return { readPage, command, close, status };
}
