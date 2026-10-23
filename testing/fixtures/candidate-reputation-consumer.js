/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import pg from 'pg';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';
import { createTrustSnapshotStore } from '../../src/server/recovery/trust-snapshot-store.js';

// Owned test subprocess only. Configuration travels over private IPC, never logs/argv.
if (!process.send) throw new Error('Owned candidate fixture IPC is required');
process.once('message', async ({ connectionConfig, candidateId, phase }) => {
  const pool = new pg.Pool(connectionConfig); const getPoolFn = () => pool;
  const record = createSourceUserTrustEvidenceService({ ...createTrustSnapshotStore({ getPoolFn }),
    appendOutcomeEventFn: createSourceUserOutcomeLedgerStore({ getPoolFn }).appendOutcomeEvent }).recordSourceUserOutcomeEvidence;
  const hold = async () => { process.send('held'); await new Promise(() => {}); };
  try {
    await createImportCandidateService({ pool, recordAuditEventFn: async () => {}, recordSourceUserOutcomeEvidenceFn: async event => {
      const result = await record(event);
      if (phase === 'before-commit') await hold();
      return { ...result, afterCommit: phase === 'after-commit' ? hold : result.afterCommit };
    } }).markImportCandidateDownloadFailed({ importCandidateId: candidateId });
  } finally { await pool.end(); process.disconnect(); }
});
