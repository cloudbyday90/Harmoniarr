/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const FOLDER_PAGE_SIZE = 100;
export const FOLDER_SCAN_LIMIT = 50_000;
export const FOLDER_PATH_LIMIT = 8192;
export const FOLDER_CURSOR_LIMIT = 8192;

export function isFolderPage(page, entries) {
  const cursor = value => value === null || (typeof value === 'string' && value.length > 0 && value.length <= FOLDER_CURSOR_LIMIT);
  return page?.limit === FOLDER_PAGE_SIZE && Array.isArray(entries) && entries.length <= FOLDER_PAGE_SIZE
    && Number.isSafeInteger(page.total) && page.total >= 0 && page.total <= FOLDER_SCAN_LIMIT
    && Number.isSafeInteger(page.from) && Number.isSafeInteger(page.to)
    && (page.total === 0 ? page.from === 0 && page.to === 0 && entries.length === 0
      : page.from >= 1 && (page.from - 1) % FOLDER_PAGE_SIZE === 0 && page.to <= page.total
        && page.to - page.from + 1 === entries.length && entries.length === Math.min(FOLDER_PAGE_SIZE, page.total - page.from + 1))
    && cursor(page.previousCursor) && cursor(page.nextCursor)
    && (page.previousCursor !== null) === (page.from > 1)
    && (page.nextCursor !== null) === (page.to < page.total);
}
