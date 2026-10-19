/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { formatEarlyFailure } from './early-failure-format.js';
import { createPostgresCohortAccumulator } from './postgres-cohort-accumulator.js';

export function createIntegrationEvidenceReporter({ projectRoot = process.cwd() } = {}) {
  return async function* reportIntegrationEvidence(source) {
    const cohort = createPostgresCohortAccumulator({ projectRoot });
    for await (const event of source) {
      cohort.write(event);
      const diagnostic = formatEarlyFailure(event, { projectRoot });
      if (diagnostic !== null) yield diagnostic;
    }
    yield cohort.end();
  };
}

export default createIntegrationEvidenceReporter();
