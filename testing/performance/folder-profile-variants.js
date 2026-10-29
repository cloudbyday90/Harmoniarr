/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const comparisons = Object.freeze({
  algorithms: Object.freeze([{ algorithm: 'stream', bufferSize: 32 }, { algorithm: 'readdir', bufferSize: null }].map(Object.freeze)),
  buffers: Object.freeze([{ algorithm: 'stream', bufferSize: 32 }, { algorithm: 'stream', bufferSize: 128 }].map(Object.freeze)),
});

/** Fixed experiment choices cannot change production policy or accept arbitrary buffers. */
export function folderProfileVariants(comparison = 'algorithms') {
  if (!Object.hasOwn(comparisons, comparison)) throw new TypeError('Invalid folder profile comparison');
  return comparisons[comparison];
}

export function assertFolderProfileVariant(algorithm, bufferSize) {
  if (!((algorithm === 'stream' && [32, 128].includes(bufferSize)) || (algorithm === 'readdir' && bufferSize === null))) {
    throw new TypeError('Invalid folder profile variant');
  }
}
