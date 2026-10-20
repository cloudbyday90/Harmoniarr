/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { nativePartialPlans } from './native-partial-plan.js';

export const nativeResumePlans = Object.freeze(nativePartialPlans.slice(1));

/** Two bounded native invocations per unchanged declared file; capabilities are never recycled. */
export function createNativeResumePolicy() {
  const tokens = new Map(); const histories = new Map();
  const requireRecord = token => {
    const record = tokens.get(token);
    if (!record) throw new Error('Unowned resume token');
    return record;
  };
  return {
    reserve(token, filename) {
      const plan = nativeResumePlans.find(row => row.file.filename === filename);
      const history = histories.get(filename) ?? [];
      if (!plan || !Number.isInteger(token) || token < 0 || token > 0xffffffff || tokens.has(token)
        || history.length >= 2 || (history.length === 1 && (!history[0].sent || !history[0].closed))) {
        throw new Error('Unowned, premature or excess native retry');
      }
      const record = { plan, attempt: history.length + 1, claimed: false, started: false, sent: false, closed: false };
      history.push(record); histories.set(filename, history); tokens.set(token, record);
      return record;
    },
    claim(token) {
      const record = requireRecord(token);
      if (record.claimed) throw new Error('Replayed resume capability');
      record.claimed = true; return record;
    },
    acceptOffset(token, offset) {
      const record = requireRecord(token);
      return record.claimed && !record.started && typeof offset === 'bigint'
        && (record.attempt === 1 ? offset === 0n : offset >= 16384n && offset <= BigInt(record.plan.bytes));
    },
    start(token, offset) {
      if (!Number.isSafeInteger(offset) || offset < 0 || !this.acceptOffset(token, BigInt(offset))) throw new Error('Invalid owned resume offset');
      const record = requireRecord(token); record.started = true; return record;
    },
  };
}
