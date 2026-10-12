/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { persistSettings } from '../../src/server/settings.js';
import { createLibraryScanReceiptService } from '../../src/server/library/library-scan-receipt-service.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { createLibraryScanReceiptStore } from '../../src/server/library/library-scan-receipt-store.js';
import { captureScanReceipt } from '../../src/server/library/library-scan-receipt-policy.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import assert from 'node:assert/strict';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { buildTrackReceipt, seedTrackReceiptCandidate } from './operator-track-receipt-fixture.js';
import { observeCatalogueFixtureFiles } from './library-scan-catalogue-scenario.js';
import { startLibraryScanCatalogueFixtureWorker } from './library-scan-catalogue-worker-fixture.js';

export async function seedScanReceiptFixture(c) {
  await persistSettings([{ namespace: 'paths', settingKey: 'music', value: c.rootPath }], null, c.pool);
  const receipts = []; const files = []; const bytes = Buffer.from('Private receipt fixture bytes');
  for (let index = 0; index < 2; index++) {
    const relativeRoot = `receipt-owner-${index}`; const privateRoot = join(c.rootPath, 'users', relativeRoot);
    await mkdir(privateRoot, { recursive: true }); const file = join(privateRoot, 'track.flac'); await writeFile(file, bytes); files.push(file);
    const user = (await c.pool.query(`INSERT INTO app_users(username,password_hash,role,managed_library_relative_root)
      VALUES($1,'fixture-not-a-login-hash','operator',$2) RETURNING id`, [`receipt-owner-${index}`, relativeRoot])).rows[0];
    const receipt = buildTrackReceipt({ ownerId: user.id, ...(index ? { metadataReleaseId: receipts[0].scope.metadataReleaseId } : {}) });
    receipt.wantedReleaseId = randomUUID(); receipt.files[0].libraryPath = file;
    receipt.files[0].evidence = await fingerprintOperatorTrackFile(file); receipts.push(receipt);
  }
  const candidate = await seedTrackReceiptCandidate(c.pool, { version: 2, receipts });
  const observed = await observeCatalogueFixtureFiles(c.requestedRoot);
  await c.catalog.recordLibraryFiles({ libraryRootPath: observed.summary.libraryRoot, files: observed.files });
  const service = createLibraryScanReceiptService({ getPoolFn: c.getPoolFn });
  const selected = await createLibraryScanReceiptStore().listForRoot({ root: c.rootPath, queryable: c.pool });
  assert.equal(selected.length, 2, 'Both private receipt rows must be in root scope');
  for (const row of selected) {
    assert.ok(captureScanReceipt(row, c.rootPath), 'Private receipt shape must be eligible');
    await createOperatorTrackDeliveryPlanService({ getPoolFn: c.getPoolFn }).resolvePrivateOwnerRoot({ ownerId: row.app_user_id, queryable: c.pool });
  }
  const owner = createLibraryScanCatalogueService({ receiptService: service, withTransaction: c.withTransaction,
    recordLibraryFiles: c.catalog.recordLibraryFiles,
    assertMaintenanceWriteAllowed: ({ queryable }) => c.guard.assertNoActiveWriteLocks({ queryable }) });
  return { ...c, candidateId: candidate.id, receipts, privateFiles: files, bytes, receiptOwner: owner };
}
export async function startScanReceiptWorker(c, { afterWalk } = {}) {
  return startLibraryScanCatalogueFixtureWorker({ scope: c.scope, runs: c.a, runId: c.run.id, requestedRoot: c.requestedRoot,
    afterWalk, recordLibraryScanCatalogue: c.receiptOwner.recordLibraryScanCatalogue,
    captureLibraryScanReceiptSnapshot: c.receiptOwner.captureLibraryScanReceiptSnapshot });
}
