import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const downloaderViewPath = new URL('../../src/client/views/DownloaderView.vue', import.meta.url);
const executionPanelPath = new URL('../../src/client/components/ImportCandidateExecutionPanel.vue', import.meta.url);

test('ImportCandidateExecutionPanel exposes a handoff from live transfers to Downloader', async () => {
  const source = await readFile(executionPanelPath, 'utf8');

  assert.match(source, /buildDownloaderTransferLocation/);
  assert.match(source, /downloaderTransferLocation\(transfer\)/);
  assert.match(source, /Open in Downloader/);
  assert.match(source, /<dt>Confirming<\/dt>/);
});

test('DownloaderView opens transfer details from route query handoffs', async () => {
  const source = await readFile(downloaderViewPath, 'utf8');

  assert.match(source, /normalizeDownloaderTransferRouteQuery/);
  assert.match(source, /selectRouteTransferIfAvailable/);
  assert.match(source, /routeTransferTarget\.value\.open !== 'details'/);
  assert.match(source, /omitDownloaderTransferRouteQuery/);
});

test('DownloaderView explains stale transfer route query handoffs', async () => {
  const source = await readFile(downloaderViewPath, 'utf8');

  assert.match(source, /routeTransferLookupNotice/);
  assert.match(source, /Transfer is no longer visible in Downloader/);
  assert.match(source, /role="status"/);
  assert.match(source, /Clear link/);
});
