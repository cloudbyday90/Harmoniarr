/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const folderProfileName = index => 'folder-' + String(index).padStart(5, '0');

/** Preserve an NFC/NFD pair while bounding every component to 255 UTF-8 bytes. */
export function longFolderProfileName(index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 50_000) throw new TypeError('Invalid long-name fixture index');
  const suffix = String(Math.floor(index / 4)).padStart(5, '0');
  switch (index % 4) {
    case 0: return 'p'.repeat(240) + '-ascii----' + suffix;
    case 1: return 'p'.repeat(242) + '-caf\u00e9-' + suffix;
    case 2: return 'p'.repeat(242) + '-cafe\u0301-' + suffix;
    default: return 'p'.repeat(244) + '-\u{1f3b5}-' + suffix;
  }
}

export const folderProfileDirectoryName = (profile, index) => profile.longNames ? longFolderProfileName(index) : folderProfileName(index);

/** Independent ordinal model; retain one expected page, never a full ceiling list. */
export function expectedFolderProfilePage(profile, page = 0) {
  if (!Number.isSafeInteger(page) || page < 0) throw new TypeError('Invalid expected page');
  const from = page * 100, to = Math.min(from + 100, profile.directories);
  if (!profile.longNames) return Array.from({ length: Math.max(0, to - from) }, (_, index) => folderProfileName(from + index));
  const names = []; let groupFrom = 0;
  // Shorter ASCII prefix first, then decomposed/composed forms, then the emoji prefix.
  for (const variant of [0, 2, 1, 3]) {
    const size = Math.max(0, Math.ceil((profile.directories - variant) / 4));
    for (let index = Math.max(0, from - groupFrom); index < Math.min(size, to - groupFrom); index++) names.push(longFolderProfileName(index * 4 + variant));
    groupFrom += size;
  }
  return names;
}
