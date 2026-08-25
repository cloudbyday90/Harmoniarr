import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const filtersPath = new URL('../../src/client/components/downloader/DownloaderTransferFilters.vue', import.meta.url);
const viewPath = new URL('../../src/client/views/DownloaderView.vue', import.meta.url);

test('DownloaderTransferFilters uses grouped native controls with visible labels', async () => {
  const source = await readFile(filtersPath, 'utf8');

  assert.match(source, /<fieldset class="downloader-transfer-filters">/);
  assert.match(source, /<legend class="sr-only">Filter transfers<\/legend>/);
  assert.match(source, /<select class="hx-select" :value="stateFilter" @change="updateStateFilter">/);
  assert.match(source, /<input\s+type="checkbox"/);
  assert.match(source, /Only transfers linked to Music Queue/);
  assert.match(source, /min-height: 44px/);
  assert.match(source, /:focus-within/);
});

test('DownloaderView announces only user-initiated filter result changes', async () => {
  const source = await readFile(viewPath, 'utf8');

  assert.match(source, /filterResultAnnouncement/);
  assert.match(source, /async function announceFilterResult/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source, /<DownloaderTransferFilters/);
  assert.match(source, /@update:music-queue-linked-only="updateMusicQueueLinkedOnly"/);
  assert.match(source, /@update:state-filter="updateStateFilter"/);
  assert.match(source, /No transfers match these filters/);
});
