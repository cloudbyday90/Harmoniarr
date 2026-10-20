/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { nativeTransferFiles } from './native-file-data.js';

export const nativePartialPlans = Object.freeze([
  Object.freeze({ file: nativeTransferFiles[0], kind: 'complete', bytes: nativeTransferFiles[0].size }),
  Object.freeze({ file: nativeTransferFiles[1], kind: 'eof', bytes: nativeTransferFiles[1].size - 1 }),
  Object.freeze({ file: nativeTransferFiles[2], kind: 'reset', bytes: 32791 }),
]);
