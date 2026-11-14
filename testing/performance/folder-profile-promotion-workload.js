/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { opendir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { expectedFolderProfilePage } from './folder-profile-names.js';
import { folderProfileCases } from './folder-profile-policy.js';

/** Exercise the packaged production option directly, without buffer substitution. */
export function createFolderPromotionWorkload({ createService, path, overflow = false, filesystem = { opendir, stat } }) {
  const expected = [0, 1, 2].map(page => expectedFolderProfilePage(folderProfileCases.names, page));
  return async () => {
    const counts = { opens: 0, closes: 0, reads: 0, liveHandles: 0, productionOptionChecks: 0 };
    const makeService = ({ timeout = false, changed = false } = {}) => {
      let clock = 0, stats = 0;
      return createService({ ...(timeout ? { now: () => clock } : {}),
        readStat: (...args) => {
          const pending = filesystem.stat(...args);
          if (!changed) return pending;
          return pending.then(row => ++stats === 2 ? { ...row, isDirectory: () => row.isDirectory(), mtimeNs: row.mtimeNs + 1n } : row);
        },
        openDirectory: async (directoryPath, options) => {
          assert.deepEqual(options, { bufferSize: 128 }); counts.productionOptionChecks++;
          const directory = await filesystem.opendir(directoryPath, options); counts.opens++; counts.liveHandles++;
          return { read: () => { counts.reads++; const pending = directory.read(); if (timeout) clock = 5000; return pending; },
            close: async () => { await directory.close(); counts.closes++; counts.liveHandles--; } };
        },
      });
    };
    const browse = (service, options = {}) => service.browse({ path, actorUserId: 'folder-promotion-admin', ...options });
    const refused = async (work, code) => { await assert.rejects(work, error => error?.code === code); return code; };
    if (overflow) {
      const service = makeService();
      await refused(() => browse(service), 'folder_scan_limit');
      assert.equal(counts.reads, 50_001); assert.equal(counts.opens, 1); assert.equal(counts.closes, 1); assert.equal(counts.liveHandles, 0);
      return { productionBufferSize: 128, actualNativeOverflow: true, rawReads: counts.reads, refusal: 'folder_scan_limit', counts };
    }
    const service = makeService(), pages = []; let cursor;
    const checkPage = (result, page) => {
      assert.equal(result.page.total, 203); assert.equal(result.page.from, page * 100 + 1); assert.equal(result.page.to, Math.min((page + 1) * 100, 203));
      assert.deepEqual(result.entries.map(entry => entry.name), expected[page]);
      for (const entry of result.entries) assert.equal(entry.path, resolve(path, entry.name));
    };
    for (let page = 0; page < 3; page++) { const result = await browse(service, { cursor }); checkPage(result, page); pages.push(result); cursor = result.page.nextCursor; }
    assert.equal(cursor, null);
    for (let page = 1; page >= 0; page--) { const result = await browse(service, { cursor: pages[page + 1].page.previousCursor }); checkPage(result, page); }
    const names = pages.flatMap(result => result.entries.map(entry => entry.name));
    assert.equal(new Set(names).size, 203);
    assert.ok(names.some(name => name !== name.normalize('NFC'))); assert.ok(names.some(name => name.includes('\u{1f3b5}')));
    assert.ok(names[99].includes('\u0301')); assert.ok(names[199].includes('\u{1f3b5}'));
    const beforeCursorChecks = counts.opens;
    const cursorRefusals = [await refused(() => browse(service, { cursor: pages[0].page.nextCursor, actorUserId: 'other-admin' }), 'folder_page_changed'),
      await refused(() => browse(service, { cursor: pages[0].page.nextCursor + 'x' }), 'folder_page_changed')];
    assert.equal(counts.opens, beforeCursorChecks);
    const refusals = [
      await refused(() => browse(makeService({ changed: true })), 'folder_page_changed'),
      await refused(() => browse(makeService({ timeout: true })), 'folder_browse_timeout'),
      await refused(() => browse(service, { path: resolve(path, 'file-00203') }), 'folder_not_directory'),
      await refused(() => browse(service, { path: resolve(path, 'absent-folder') }), 'folder_not_found'),
    ];
    assert.equal(counts.opens, counts.closes); assert.equal(counts.liveHandles, 0); assert.equal(counts.productionOptionChecks, counts.opens);
    return { productionBufferSize: 128, forwardPages: 3, reversePages: 2, exactNames: 203, uniqueNames: 203,
      normalizationPreserved: true, unicodeAnchors: true, ordinaryFileExcluded: true, cursorRefusals, refusals,
      digest: createHash('sha256').update(names.join('\n')).digest('hex'), counts };
  };
}
