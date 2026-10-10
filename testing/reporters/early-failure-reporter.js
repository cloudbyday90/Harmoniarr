/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { formatEarlyFailure } from './early-failure-format.js';

export function createEarlyFailureReporter({ projectRoot = process.cwd() } = {}) {
  return async function* reportEarlyFailures(source) {
    for await (const event of source) {
      const diagnostic = formatEarlyFailure(event, { projectRoot });
      if (diagnostic !== null) yield diagnostic;
    }
  };
}

export default createEarlyFailureReporter();
