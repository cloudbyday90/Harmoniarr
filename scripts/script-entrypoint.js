/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { pathToFileURL } from 'node:url';

export function isDirectExecution(importMeta, argv = process.argv) {
  if (typeof importMeta?.main === 'boolean') {
    return importMeta.main;
  }

  const entryPath = Array.isArray(argv) ? argv[1] : null;

  return entryPath ? importMeta?.url === pathToFileURL(entryPath).href : false;
}