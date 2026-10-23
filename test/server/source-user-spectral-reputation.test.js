/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';
import { createSourceUserSpectralJobService } from '../../src/server/activity/source-user-spectral-job-service.js';
import { withDatabasePublicationScope } from '../../src/server/database-publication-scope.js';

test('strict spectral evidence refuses absent, foreign and expired ownership before any write', async () => {
  const job = { id: 'first', origin: 'apply', username: 'peer' };
  const service = createSourceUserTrustEvidenceService({ appendOutcomeEventFn: () => assert.fail('No unauthorized insert') });
  await assert.rejects(service.recordSpectralOutcomeEvidence({ job, queryable: { query() {} } }), /authority/);
  let retained;
  await withDatabasePublicationScope({ queryable: {}, kind: 'spectral_job', ownerId: 'second' }, async queryable => {
    retained = queryable;
    await assert.rejects(service.recordSpectralOutcomeEvidence({ job, queryable }), /authority/);
  });
  await assert.rejects(service.recordSpectralOutcomeEvidence({ job: { ...job, id: 'second' }, queryable: retained }), /authority/);
});

test('strict spectral evidence requires a transaction-capable snapshot adapter', async () => {
  const service = createSourceUserTrustEvidenceService({ appendOutcomeEventFn: () => assert.fail('No insert before mutation admission') });
  await withDatabasePublicationScope({ queryable: {}, kind: 'spectral_job', ownerId: 'first' }, async queryable => {
    await assert.rejects(service.recordSpectralOutcomeEvidence({ job: { id: 'first', origin: 'apply', username: 'peer' }, queryable }), /Transactional trust/);
  });
});

test('missing durable reputation sink refuses spectral publication and never invokes advisories', async () => {
  const service = createSourceUserSpectralJobService({ spectralJobStore: {
    withSpectralJobClaim: (_input, work) => work({ query() {} }), completeSpectralJob: async () => ({ id: 'first' }),
  } });
  await assert.rejects(service.publishJob({ job: { id: 'first', origin: 'apply' },
    expectedClaim: { id: 'first', attempts: 1 }, prepared: { classification: { penalize: true }, measurement: {} } }), /Transactional spectral/);
});
