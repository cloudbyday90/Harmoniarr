/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Filtered observations of one run may contain different candidates; unite them before reconciliation. */
export function mergeExecutionObservationRuns(runs) {
  const observed = new Map();
  for (const run of runs.filter(Boolean)) {
    let merged = observed.get(run.id);
    if (!merged) { merged = { run, items: new Map() }; observed.set(run.id, merged); }
    for (const item of run.items ?? []) {
      const key = item.importCandidateId ?? item.planningSnapshot?.candidate?.id ?? item.id ?? Symbol();
      const previous = merged.items.get(key);
      const time = (value) => Date.parse(value?.handoffConfirmation?.checkedAt ?? value?.updatedAt);
      if (!previous || !Number.isFinite(time(previous)) || !Number.isFinite(time(item)) || time(item) >= time(previous)) merged.items.set(key, item);
    }
  }
  return [...observed.values()].map(({ run, items }) => ({ ...run, items: [...items.values()] }));
}
