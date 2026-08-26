import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const drawerPath = new URL('../../src/client/components/downloader/DownloaderTransferDetailDrawer.vue', import.meta.url);
const rowHandoffsPath = new URL('../../src/client/components/downloader/DownloaderTransferRowHandoffs.vue', import.meta.url);
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

test('DownloaderTransferDetailDrawer exposes a descriptive Missing Music release handoff only when available', async () => {
  const source = await readFile(drawerPath, 'utf8');

  assert.match(source, /buildDownloaderMissingMusicDecisionLocation/);
  assert.match(source, /Missing Music release/);
  assert.match(source, /missingMusicDecisionLocation/);
  assert.match(source, /missingMusicDecisionLinkLabel/);
});

test('DownloaderView opens diagnostics from an explicit Details action', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /DownloaderTransferDetailDrawer/);
  assert.match(source, /selectedTransferKey/);
  assert.match(source, /@click="openTransferDetail\(file\)"/);
  assert.match(source, />\s*Details\s*<\/button>/);
});

test('DownloaderTransferRowHandoffs renders only its durable transfer destinations as native links', async () => {
  const source = await readFile(rowHandoffsPath, 'utf8');

  assert.match(source, /buildDownloaderImportCandidateLocation/);
  assert.match(source, /buildDownloaderMissingMusicDecisionLocation/);
  assert.match(source, /buildDownloaderMissingMusicDecisionLinkLabel/);
  assert.match(source, /v-if="missingMusicDecisionLocation"/);
  assert.match(source, /<RouterLink/);
  assert.match(source, /Open advanced diagnostics/);
  assert.match(source, /min-height: 24px/);
  assert.match(source, /min-height: 44px/);
  assert.match(source, /:focus-visible/);
});

test('DownloaderView keeps Details primary and delegates compact transfer destinations', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /DownloaderTransferRowHandoffs/);
  assert.match(source, /<DownloaderTransferRowHandoffs :transfer="file" \/>/);
  assert.ok(source.indexOf('>\n                      Details\n                    </button>') < source.indexOf('<DownloaderTransferRowHandoffs'));
});

test('DownloaderView wires operator controls to downloader mutation APIs', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /requestDownloaderTransferAction/);
  assert.match(source, /clearCompletedDownloaderTransfers/);
  assert.match(source, /@request-action="performTransferAction"/);
  assert.match(source, /Clear Completed/);
  assert.match(source, /pendingAction === 'clear_completed'/);
});
