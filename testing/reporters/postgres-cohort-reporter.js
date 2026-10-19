/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createPostgresCohortAccumulator } from './postgres-cohort-accumulator.js';

export default async function* reportPostgresCohort(source) {
  const cohort = createPostgresCohortAccumulator();
  for await (const event of source) cohort.write(event);
  yield cohort.end();
}
