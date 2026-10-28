/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createFolderPageSelector } from '../../src/server/filesystem/folder-page-selector.js';

test('bounded selection matches full sorted pages in both directions for arbitrary enumeration order', () => {
  const names = Array.from({ length: 357 }, (_, index) => `Folder ${String(index).padStart(3, '0')}`);
  names.push('ALBUM', 'Album', 'album', 'é', '中文');
  const sorted = names.toSorted();
  // Coprime step visits every name in a deliberately unsorted order.
  const unordered = names.map((_, index) => names[(index * 53) % names.length]);
  for (const direction of ['next', 'previous']) for (const anchor of [null, sorted[0], sorted[99], sorted[200], sorted.at(-1)]) {
    if (anchor === null && direction === 'previous') continue;
    const selector = createFolderPageSelector({ anchor, direction });
    for (const name of unordered) { selector.add(name); assert.ok(selector.result().names.length <= 100); }
    const expected = sorted.filter(name => anchor === null || (direction === 'next' ? name > anchor : name < anchor));
    const page = direction === 'next' ? expected.slice(0, 100) : expected.slice(-100);
    assert.deepEqual(selector.result().names, page);
    assert.equal(selector.result().total, names.length);
    if (page.length) { assert.equal(selector.result().from, sorted.indexOf(page[0]) + 1); assert.equal(selector.result().to, sorted.indexOf(page.at(-1)) + 1); }
  }
});
