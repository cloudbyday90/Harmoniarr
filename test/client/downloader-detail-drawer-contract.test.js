import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const drawerPath = new URL('../../src/client/components/downloader/DownloaderTransferDetailDrawer.vue', import.meta.url);
const viewPath = new URL('../../src/client/views/DownloaderView.vue', import.meta.url);

test('DownloaderTransferDetailDrawer follows the modal dialog accessibility contract', async () => {
  const source = await readFile(drawerPath, 'utf8');

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="downloader-detail-title"/);
  assert.match(source, /:ref="setDialogRef"/);
  assert.match(source, /props\.open && !dialogRef\.open/);
  assert.match(source, /@cancel="onCancel"/);
  assert.match(source, /dialogRef\.showModal\(\)/);
  assert.match(source, /aria-label="Close transfer diagnostics"/);
  assert.match(source, /min-width: 44px/);
  assert.match(source, /min-height: 44px/);
});

test('DownloaderTransferDetailDrawer exposes server-owned operator action eligibility', async () => {
  const source = await readFile(drawerPath, 'utf8');

  assert.match(source, /aria-label="Operator controls"/);
  assert.match(source, /actionEligibility\?\.actions/);
  assert.match(source, /defineEmits\(\['close', 'request-action'\]\)/);
  assert.match(source, /@click="emit\('request-action', action\.code\)"/);
  assert.match(source, /:disabled="!action\.enabled \|\| Boolean\(actionPending\)"/);
  assert.match(source, /retry_provider_contract_not_available|action\.reason/);
});

test('DownloaderTransferDetailDrawer exposes import candidate drill-through when linked', async () => {
  const source = await readFile(drawerPath, 'utf8');

  assert.match(source, /buildDownloaderImportCandidateLocation/);
  assert.match(source, /Open advanced diagnostics/);
  assert.match(source, /diagnostics\.importLinkage\?\.summary/);
});

test('DownloaderView opens diagnostics from an explicit Details action', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /DownloaderTransferDetailDrawer/);
  assert.match(source, /selectedTransferKey/);
  assert.match(source, /@click="openTransferDetail\(file\)"/);
  assert.match(source, />\s*Details\s*<\/button>/);
});

test('DownloaderView exposes import candidate drill-through links for linked transfers', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /buildDownloaderImportCandidateLocation/);
  assert.match(source, /importCandidateLocation\(file\)/);
  assert.match(source, /Open advanced diagnostics/);
});

test('DownloaderView wires operator controls to downloader mutation APIs', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /requestDownloaderTransferAction/);
  assert.match(source, /clearCompletedDownloaderTransfers/);
  assert.match(source, /@request-action="performTransferAction"/);
  assert.match(source, /Clear Completed/);
  assert.match(source, /pendingAction === 'clear_completed'/);
});
