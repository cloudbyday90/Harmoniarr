/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import pg from 'pg';
import { createRestoreScopeRuntimeSnapshotStore } from '../../src/server/recovery/restore-scope-runtime-snapshot-store.js';
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';
import { createSourceUserSpectralCacheStore } from '../../src/server/activity/source-user-spectral-cache-store.js';
import { createSourceUserSpectralSidecarService } from '../../src/server/activity/source-user-spectral-sidecar-service.js';

if (!process.send) throw new Error('Owned fixture IPC is required');
process.once('message', async ({ connectionConfig, phase }) => {
  const pool = new pg.Pool(connectionConfig);
  const getPoolFn = () => pool;
  const ledger = createSourceUserOutcomeLedgerStore({ getPoolFn });
  const snapshots = createRestoreScopeRuntimeSnapshotStore({ getPoolFn });
  const evidence = createSourceUserTrustEvidenceService({ ...snapshots, appendOutcomeEventFn: ledger.appendOutcomeEvent });
  const hold = async () => { process.send('checkpoint'); await new Promise(() => {}); };
  try {
    await createSourceUserSpectralSidecarService({ spectralJobStore: createSourceUserSpectralJobStore({ getPoolFn }),
      spectralCacheStore: createSourceUserSpectralCacheStore({ getPoolFn }), hashFileFn: async () => 'fixture-hash',
      analyzeSpectralCutoffFn: async () => ({ cutoffHz: 15500, frameCount: 120 }),
      recordSpectralOutcomeEvidenceFn: async input => {
        const result = await evidence.recordSpectralOutcomeEvidence(input);
        if (phase === 'before-commit') await hold();
        return { ...result, afterCommit: hold };
      },
    }).processPendingSpectralJobs();
  } catch { process.exitCode = 1; }
  finally { await pool.end(); process.disconnect(); }
});
