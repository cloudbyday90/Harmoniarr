/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomInt } from 'node:crypto';

function balancedOrder(draw) {
  const values = [false, false, true, true];
  for (let index = values.length - 1; index > 0; index--) {
    const selected = draw(index + 1);
    if (!Number.isInteger(selected) || selected < 0 || selected > index) throw new TypeError('Invalid experiment draw');
    [values[index], values[selected]] = [values[selected], values[index]];
  }
  return values;
}

/** Adjacent equal-work pairs; balance both buffer and observer order. */
export function createBalancedFolderProfileBlock({ draw = randomInt, block = 0 } = {}) {
  const rows = [];
  const observedFirst = balancedOrder(draw), bufferFirst = [balancedOrder(draw), balancedOrder(draw)];
  for (let repeat = 0; repeat < 4; repeat++) for (const observed of observedFirst[repeat] ? [true, false] : [false, true]) {
    for (const bufferSize of bufferFirst[Number(observed)][repeat] ? [128, 32] : [32, 128]) {
      rows.push({ sequence: block * 16 + rows.length, block, repeat, caseName: 'mixed', pages: 1, algorithm: 'stream', bufferSize, observed });
    }
  }
  return rows;
}

export function createMixedFirstPagePlan({ draw = randomInt } = {}) {
  return Array.from({ length: 4 }, (_, block) => createBalancedFolderProfileBlock({ draw, block })).flat();
}
