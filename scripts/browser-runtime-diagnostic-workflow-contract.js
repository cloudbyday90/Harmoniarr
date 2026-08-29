/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const requiredWorkflowFragments = [
  'workflow_dispatch:',
  'permissions:\n  contents: read',
  'group: browser-runtime-diagnostic-$' + '{{ github.repository }}',
  'cancel-in-progress: false',
  'timeout-minutes: 20',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'uses: ./.github/actions/setup-project-npm',
  'npx playwright install --with-deps chromium',
  'npm run test:browser:diagnostic',
  "HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC: '1'",
  'HARMONIARR_BROWSER_RUNTIME_DIAGNOSTIC_PATH: browser-runtime-diagnostic/harmoniarr-browser-runtime-diagnostic.json',
  'HARMONIARR_BROWSER_TEST_EVIDENCE_PATH: browser-runtime-diagnostic/harmoniarr-browser-test.json',
  'HARMONIARR_BROWSER_TEST_CLEANUP_WAIT_MS: 25000',
  'node scripts/write-browser-runtime-diagnostic-summary.js',
  "if: always() && hashFiles('browser-runtime-diagnostic/harmoniarr-browser-runtime-diagnostic.json') != ''",
  'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  'if-no-files-found: warn',
  'retention-days: 14',
];

const disallowedWorkflowFragments = [
  'pull_request:',
  'push:',
  'secrets.',
];

export function assertBrowserRuntimeDiagnosticWorkflowContract(workflowSource) {
  if (typeof workflowSource !== 'string' || workflowSource.trim() === '') {
    throw new Error('browser runtime diagnostic workflow source is required');
  }

  for (const fragment of requiredWorkflowFragments) {
    if (!workflowSource.includes(fragment)) {
      throw new Error(`browser runtime diagnostic workflow is missing required fragment: ${fragment}`);
    }
  }

  for (const fragment of disallowedWorkflowFragments) {
    if (workflowSource.includes(fragment)) {
      throw new Error(`browser runtime diagnostic workflow must not include: ${fragment}`);
    }
  }

  return true;
}
