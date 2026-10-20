/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { nativeTransferFiles, nativeFileDigest } from './native-file-data.js';
import { inspectNativeBytes } from './native-file-read.js';

export async function inspectNativeFile(root, file) {
  if (!nativeTransferFiles.includes(file)) throw new TypeError('An owned native file is required');
  return inspectNativeBytes(root, file, { parts: file.filename.split('\\'), minBytes: file.size, maxBytes: file.size,
    digestForLength: () => nativeFileDigest(file) });
}
