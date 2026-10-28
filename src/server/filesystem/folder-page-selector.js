/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { FOLDER_PAGE_SIZE } from '../../shared/folder-browse-policy.js';

/** Retains at most one sorted page, independent of directory enumeration order. */
export function createFolderPageSelector({ anchor = null, direction = 'next' } = {}) {
  const names = [];
  let total = 0, beforeAnchor = 0;
  function add(name) {
    total++;
    if (anchor !== null && (direction === 'next' ? name <= anchor : name < anchor)) beforeAnchor++;
    if (anchor !== null && (direction === 'next' ? name <= anchor : name >= anchor)) return;
    if (names.length === FOLDER_PAGE_SIZE) {
      if (direction === 'next' ? name >= names.at(-1) : name <= names[0]) return;
      if (direction === 'next') names.pop(); else names.shift();
    }
    let low = 0, high = names.length;
    while (low < high) { const middle = (low + high) >>> 1; if (names[middle] < name) low = middle + 1; else high = middle; }
    names.splice(low, 0, name);
  }
  function result() {
    const offset = direction === 'next' ? beforeAnchor : beforeAnchor - names.length;
    return { names, total, from: names.length ? offset + 1 : 0, to: names.length ? offset + names.length : 0 };
  }
  return { add, result };
}
