/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { nativePartialPlans } from './native-partial-plan.js';

export const nativeRefusalPlans = Object.freeze(nativePartialPlans.slice(1).map(partial => Object.freeze({
  partial, kind: partial.kind === 'eof' ? 'exhaustion' : 'size-change', maxAttempts: partial.kind === 'eof' ? 3 : 2,
})));

/** Bound the two distinct refusal paths without weakening successful resume capabilities. */
export function createNativeRefusalPolicy() {
  const tokens = new Map(); const histories = new Map();
  const get = token => {
    const record = tokens.get(token);
    if (!record) throw new Error('Unowned refusal token');
    return record;
  };
  const acceptOffset = (token, offset) => {
    const record = get(token);
    return record.claimed && !record.started && typeof offset === 'bigint'
      && offset === (record.attempt === 1 ? 0n : BigInt(record.plan.partial.bytes));
  };
  return {
    reserve(token, filename) {
      const plan = nativeRefusalPlans.find(row => row.partial.file.filename === filename);
      const history = histories.get(filename) ?? [];
      if (!plan || !Number.isInteger(token) || token < 0 || token > 0xffffffff || tokens.has(token)
        || history.length >= plan.maxAttempts || (history.length && (!history.at(-1).sent || !history.at(-1).closed))) {
        throw new Error('Unowned, premature or excess refusal request');
      }
      const attempt = history.length + 1;
      const changedSize = plan.kind === 'size-change' && attempt === 2;
      const record = { plan, attempt, advertisedSize: plan.partial.file.size + Number(changedSize), acceptsFile: !changedSize,
        claimed: false, started: false, sent: false, closed: false };
      history.push(record); histories.set(filename, history); tokens.set(token, record);
      return record;
    },
    claim(token) {
      const record = get(token);
      if (!record.acceptsFile || record.claimed) throw new Error('Refused or replayed file capability');
      record.claimed = true; return record;
    },
    acceptOffset,
    start(token, offset) {
      if (!Number.isSafeInteger(offset) || offset < 0 || !acceptOffset(token, BigInt(offset))) throw new Error('Invalid refusal offset');
      const record = get(token); record.started = true; return record;
    },
  };
}
