/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { prepareLibraryTestSchema } from './library-test-schema-preparation.js';
import { createMusicQueueRecoveryFixtureContext } from './music-queue-recovery-fixtures.js';

/** Schema and returned scenario work share one private database and its actual lifetime. */
export async function withMusicQueueRecoveryScenario(runtime, t, run, {
  prepareSchema = prepareLibraryTestSchema, createContext = createMusicQueueRecoveryFixtureContext,
} = {}) {
  if (typeof runtime?.runIsolatedDatabase !== 'function' || typeof run !== 'function'
    || typeof prepareSchema !== 'function' || typeof createContext !== 'function') throw new TypeError('Invalid recovery fixture scenario');
  return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseConfig, databaseName, phaseObserver }) => {
    await prepareSchema({ getPoolFn, phaseObserver, signal: t?.signal });
    return phaseObserver.measure('scenario_work', () => run({ ...createContext({ getPoolFn }),
      databaseConfig, databaseName, phaseObserver, fixtureSignal: t?.signal }));
  }, { signal: t?.signal });
}
