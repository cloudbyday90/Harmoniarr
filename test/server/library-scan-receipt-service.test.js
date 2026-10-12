/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createLibraryScanReceiptService } from '../../src/server/library/library-scan-receipt-service.js';
import { createLibraryScanReceiptFileService } from '../../src/server/library/library-scan-receipt-file-service.js';
import { captureScanReceipt, currentScanReceiptSource } from '../../src/server/library/library-scan-receipt-policy.js';
import { createLibraryScanReceiptStore } from '../../src/server/library/library-scan-receipt-store.js';
import { buildTrackReceipt } from '../../testing/integration/operator-track-receipt-fixture.js';

function fixture() {
  const receipt = buildTrackReceipt(); receipt.wantedReleaseId = randomUUID(); receipt.files[0].libraryPath = '/data/music/owner/track.flac';
  const row = { import_candidate_id: randomUUID(), app_user_id: receipt.ownerId, receipt_revision_id: randomUUID(), receipt };
  const prepared = { runId: randomUUID(), expectedLease: { acquisitionId: randomUUID(), ownerInstanceId: 'scan', leaseKey: 'scan' },
    libraryRootPath: '/data/music', requestedLibraryRoot: '/data/music', files: [] };
  const queryable = {}; const writes = []; let missing = true; let root = '/data/music/owner'; let current = row;
  let afterEvent = async () => {}; let guard = async () => {};
  const service = createLibraryScanReceiptService({ resolvePrivateRoot: async value => {
    assert.equal(value.queryable, queryable); return root;
  }, fileService: { isMissing: async ({ target, privateRoot }) => {
    if (target.privateRoot !== privateRoot) throw Object.assign(Error('Changed root'), { code: 'library_scan_receipt_stale' }); return missing;
  } }, store: {
    listForRoot: async () => [row], lockReceipt: async () => current,
    recordMissing: async ({ target, queryable: actual }) => { assert.equal(actual, queryable); writes.push(target); return true; },
    insertEvent: async () => afterEvent(),
  } });
  return { row, prepared, writes, service, queryable,
    capture: () => service.capture({ prepared, queryable }),
    record: token => service.recordMissing({ token, prepared, libraryRootId: randomUUID(), queryable, assertCurrent: () => guard() }),
    setMissing: value => { missing = value; }, setCurrent: value => { current = value; },
    setRoot: value => { root = value; }, setEvent: value => { afterEvent = value; }, setGuard: value => { guard = value; } };
}
test('opaque capture binds the original receipt; a genuine missing delivery publishes on the owning client', async () => {
  const c = fixture(); const token = await c.capture(); assert.deepEqual(Object.keys(token), []);
  assert.equal(await c.record(token), 1); assert.equal(c.writes.length, 1);
  await assert.rejects(c.record(token), { code: 'library_scan_receipt_stale' });
});
test('forged capability and changed scan acquisition cannot authorize negative publication', async () => {
  const c = fixture(); await assert.rejects(c.record({}), { code: 'library_scan_receipt_stale' });
  const token = await c.capture(); c.prepared.expectedLease.acquisitionId = randomUUID();
  await assert.rejects(c.record(token), { code: 'library_scan_receipt_stale' }); assert.equal(c.writes.length, 0);
});
test('receipt replacement, observed paths and restored files do not become missing observations', async () => {
  for (const change of ['revision', 'observed', 'restored']) {
    const c = fixture(); const token = await c.capture();
    if (change === 'revision') c.setCurrent({ ...c.row, receipt_revision_id: randomUUID() });
    if (change === 'observed') c.prepared.files.push({ canonicalPath: c.row.receipt.files[0].libraryPath });
    if (change === 'restored') c.setMissing(false);
    assert.equal(await c.record(token), 0); assert.equal(c.writes.length, 0);
  }
});
test('changed private root, late file restoration and lease refusal reject publication', async () => {
  for (const change of ['root', 'restored_after_event', 'lease']) {
    const c = fixture(); const token = await c.capture();
    if (change === 'root') c.setRoot('/data/music/other');
    if (change === 'restored_after_event') c.setEvent(async () => c.setMissing(false));
    if (change === 'lease') c.setEvent(async () => c.setGuard(async () => { throw Object.assign(Error('Expired'), { code: 'operation_run_lease_lost' }); }));
    await assert.rejects(c.record(token), { code: change === 'lease' ? 'operation_run_lease_lost' : 'library_scan_receipt_stale' });
  }
});
test('malformed or legacy receipt shapes cannot grant private scan scope', () => {
  const c = fixture(); assert.ok(captureScanReceipt(c.row, c.prepared.libraryRootPath));
  for (const mutate of [r => { delete r.receipt.wantedReleaseId; }, r => { r.receipt.files[0].libraryPath = '/data/music-neighbor/file'; },
    r => { r.receipt.files[0].libraryPath += '\u0000'; }, r => { r.receipt.files[0].evidence.sha256 = 'invalid'; }]) {
    const row = structuredClone(c.row); mutate(row); assert.equal(captureScanReceipt(row, c.prepared.libraryRootPath), null);
  }
});
test('an existing file or uncertain I/O failure is not absence', async () => {
  const target = { libraryPath: '/data/music/owner/track.flac', privateRoot: '/data/music/owner' };
  const input = { target, privateRoot: target.privateRoot, scanRoot: '/data/music' };
  assert.equal(await createLibraryScanReceiptFileService({ lstatFn: async () => ({}) }).isMissing(input), false);
  const denied = Object.assign(Error('Denied'), { code: 'EACCES' });
  await assert.rejects(createLibraryScanReceiptFileService({ lstatFn: async () => { throw denied; } }).isMissing(input), e => e === denied);
  await assert.rejects(createLibraryScanReceiptFileService({ lstatFn: async () => { throw Object.assign(Error('Missing'), { code: 'ENOENT' }); },
    realpathFn: async () => '/data/music/other' }).isMissing(input), { code: 'library_scan_receipt_stale' });
});

test('root lookup selects host spellings without expanding LIKE wildcards', async () => {
  let received;
  await createLibraryScanReceiptStore().listForRoot({ root: 'C:/music_%', queryable: { query: async (_sql, values) => {
    received = values; return { rows: [] };
  } } });
  assert.equal(received[0], 'c:/music\\_\\%/%');
  assert.equal(received[1], process.platform === 'win32' ? '/music\\_\\%/%' : null);
});

test('source correlation requires the current scan run and exact acquisition', () => {
  const source = { ownerId: 'owner', negativeScanRunId: 'run', negativeScanAcquisitionId: 'original' };
  const context = { operationType: 'library_scan', runId: 'run', expectedLease: { acquisitionId: 'original' } };
  assert.deepEqual(currentScanReceiptSource(source, context), { ownerId: 'owner', negativeScanRunId: 'run' });
  assert.deepEqual(currentScanReceiptSource(source, { ...context, expectedLease: { acquisitionId: 'replacement' } }), { ownerId: 'owner' });
  assert.deepEqual(currentScanReceiptSource(source, { mode: 'direct' }), { ownerId: 'owner' });
  assert.equal(source.negativeScanAcquisitionId, 'original');
});
