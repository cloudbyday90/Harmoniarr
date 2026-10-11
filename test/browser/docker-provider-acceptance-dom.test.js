/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, errors } from 'playwright';
import { openDownloaderQueueSnapshot, waitForDownloadAcceptanceDiagnosticPanel } from '../../scripts/docker-provider-acceptance-dom.js';

const diagnosticTitle = 'Provider accepted transfer';
const evidenceDirectory = resolve('.tmp/local-docker-rebuild-2026-10/provider-dom-failures');
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
}, { timeout: 30_000 });

after(async () => {
  await browser?.close();
});

function diagnosticPanel({ id, label = 'Download acceptance diagnostic',
  message = 'The provider accepted this request.', title = diagnosticTitle, hidden = false }) {
  // Match the actual ImportCandidateExecutionPanel structure: eyebrow and
  // strong title inside one article. Its title has no heading role.
  return `<article class="execution-diagnostic-panel" data-panel="${id}"${hidden ? ' hidden' : ''}>
    <div class="review-file-header"><div>
      <p class="eyebrow">${label}</p><strong>${title}</strong>
      <p class="metadata-card-copy">${message}</p>
    </div></div>
  </article>`;
}

async function withDiagnosticDom(scenario, content, work) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let failed = false;
  let failure;
  try {
    await page.setContent(content);
    await work({ page, disclosure: page.locator('details.import-review-runway') });
  } catch (error) {
    failed = true;
    failure = error;
    await mkdir(evidenceDirectory, { recursive: true }).catch(() => {});
    await page.screenshot({ fullPage: true, path: resolve(evidenceDirectory, `${scenario}.png`) }).catch(() => {});
  }
  try { await context.close(); } catch (error) {
    if (!failed) { failed = true; failure = error; }
  }
  if (failed) throw failure;
}

test('diagnostic evidence matches one panel despite eight repeated labels and titles and unrelated text', async () => {
  const repeated = Array.from({ length: 8 }, (_, index) => diagnosticPanel({
    id: `accepted-${index}`, message: diagnosticTitle,
  })).join('');
  await withDiagnosticDom('repeated-diagnostics', `
    ${diagnosticPanel({ id: 'outside-run-history' })}
    <details class="import-review-runway" open>
      <summary><h2>Run history and controls</h2></summary>
      ${diagnosticPanel({ id: 'wrong-label', label: 'Live transfer status' })}
      ${diagnosticPanel({ id: 'wrong-title', title: 'Provider rejected the candidate' })}
      ${repeated}
    </details>`, async ({ page, disclosure }) => {
    const panel = await waitForDownloadAcceptanceDiagnosticPanel({
      page, disclosure, title: diagnosticTitle, timeoutMs: 1_000,
    });
    assert.equal(await panel.getAttribute('data-panel'), 'accepted-0');
    assert.equal(await panel.locator('p.eyebrow').innerText(), 'Download acceptance diagnostic');
    assert.equal(await panel.locator('strong').innerText(), diagnosticTitle);
  });
});

test('hidden matching history does not prevent visible diagnostic evidence', async () => {
  await withDiagnosticDom('hidden-diagnostic', `<details class="import-review-runway" open>
    <summary><h2>Run history and controls</h2></summary>
    ${diagnosticPanel({ id: 'hidden', hidden: true })}
    ${diagnosticPanel({ id: 'visible' })}
  </details>`, async ({ page, disclosure }) => {
    const panel = await waitForDownloadAcceptanceDiagnosticPanel({
      page, disclosure, title: diagnosticTitle, timeoutMs: 1_000,
    });
    assert.equal(await panel.getAttribute('data-panel'), 'visible');
  });
});

test('labels and titles in different panels cannot establish diagnostic evidence', async () => {
  await withDiagnosticDom('split-diagnostic', `<details class="import-review-runway" open>
    <summary><h2>Run history and controls</h2></summary>
    ${diagnosticPanel({ id: 'label-only', title: 'Provider rejected the candidate' })}
    ${diagnosticPanel({ id: 'title-only', label: 'Live transfer status' })}
  </details>`, async ({ page, disclosure }) => {
    await assert.rejects(waitForDownloadAcceptanceDiagnosticPanel({
      page, disclosure, title: diagnosticTitle, timeoutMs: 250,
    }), errors.TimeoutError);
  });
});

test('matching message text cannot substitute for the diagnostic title', async () => {
  await withDiagnosticDom('message-title-decoy', `<details class="import-review-runway" open>
    <summary><h2>Run history and controls</h2></summary>
    ${diagnosticPanel({ id: 'message-decoy', title: 'Provider rejected the candidate', message: diagnosticTitle })}
  </details>`, async ({ page, disclosure }) => {
    await assert.rejects(waitForDownloadAcceptanceDiagnosticPanel({
      page, disclosure, title: diagnosticTitle, timeoutMs: 250,
    }), errors.TimeoutError);
  });
});

async function installDelayedDownloaderDom(page) {
  const baseUrl = 'http://downloader-dom.test';
  const requested = Promise.withResolvers();
  const released = Promise.withResolvers();
  const queue = { downloader: { queueHealth: { counts: { total: 3 } }, transfers: [
    { transferKey: 'linked-one', diagnostics: { importLinkage: { musicQueueRelease: { wantedReleaseId: 'release-one' } } } },
    { transferKey: 'linked-two', diagnostics: { importLinkage: { musicQueueRelease: { wantedReleaseId: 'release-one' } } } },
    { transferKey: 'unlinked' },
  ] } };
  let responseWork = null;
  await page.route(`${baseUrl}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/app/downloader') {
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>
        <h1>Downloader</h1><article class="downloader-transfer-queue">
          <h2>Transfer Queue</h2><p class="hx-card-subtitle">Showing 0 of 0 transfers.</p>
          <label><input type="checkbox">Only transfers linked to Missing Music</label>
          <p role="status" aria-live="polite"></p><table><thead><tr><th>File</th></tr></thead><tbody></tbody></table>
        </article><script>
          let transfers = [];
          const checkbox = document.querySelector('input');
          function render(announce) {
            const visible = checkbox.checked ? transfers.filter(row =>
              row.diagnostics?.importLinkage?.musicQueueRelease?.wantedReleaseId) : transfers;
            const label = 'Showing ' + visible.length + ' of ' + transfers.length + ' transfers.';
            document.querySelector('.hx-card-subtitle').textContent = label;
            document.querySelector('tbody').replaceChildren(...visible.map(() => {
              const row = document.createElement('tr');
              const cell = document.createElement('td'); cell.textContent = 'Transfer'; row.append(cell); return row;
            }));
            if (announce) document.querySelector('[role=status]').textContent = label;
          }
          checkbox.addEventListener('change', () => render(true));
          fetch('/api/v1/downloader/queue').then(response => response.json()).then(payload => {
            transfers = payload.downloader.transfers; render(false);
          });
        </script></body></html>` });
      return;
    }
    if (url.pathname === '/api/v1/downloader/queue') {
      requested.resolve();
      responseWork = (async () => {
        await released.promise;
        await route.fulfill({ json: queue });
      })();
      void responseWork.catch(() => {});
      await responseWork;
      return;
    }
    await route.abort();
  });
  return { baseUrl, requested: requested.promise, release: released.resolve,
    drain: async () => { released.resolve(); await responseWork; } };
}

test('checking a filter before delayed queue data leaves the old announcement after rows arrive', async () => {
  await withDiagnosticDom('early-filter-announcement', '', async ({ page }) => {
    const fixture = await installDelayedDownloaderDom(page);
    try {
      await page.goto(`${fixture.baseUrl}/app/downloader`, { waitUntil: 'domcontentloaded' });
      await fixture.requested;
      const checkbox = page.getByRole('checkbox');
      await checkbox.check();
      assert.equal(await page.getByRole('status').innerText(), 'Showing 0 of 0 transfers.');
      fixture.release();
      await page.locator('.hx-card-subtitle').getByText('Showing 2 of 3 transfers.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('row').count(), 3);
      assert.equal(await page.getByRole('status').innerText(), 'Showing 0 of 0 transfers.');
    } finally { await fixture.drain(); }
  });
});

test('mounted queue binding waits for loaded rows before a filter can announce the exact current snapshot', async () => {
  await withDiagnosticDom('loaded-filter-announcement', '', async ({ page }) => {
    const fixture = await installDelayedDownloaderDom(page);
    try {
      const opened = openDownloaderQueueSnapshot({ page, baseUrl: fixture.baseUrl, timeoutMs: 1_000 });
      void opened.catch(() => {});
      await Promise.race([fixture.requested, opened]);
      assert.equal(await page.getByRole('checkbox').isChecked(), false);
      assert.equal(await page.getByRole('row').count(), 1);
      fixture.release();
      const { downloaderQueue, transferQueueCard } = await opened;
      assert.equal(downloaderQueue.downloader.transfers.length, 3);
      assert.equal(await transferQueueCard.getByRole('row').count(), 4);
      await page.getByRole('checkbox').check();
      assert.equal(await transferQueueCard.getByRole('status').innerText(), 'Showing 2 of 3 transfers.');
      assert.equal(await transferQueueCard.getByRole('row').count(), 3);
    } finally { await fixture.drain(); }
  });
});
