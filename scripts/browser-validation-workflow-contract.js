/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const requiredWorkflowFragments = [
  'permissions:\n  contents: read',
  'timeout-minutes: 20',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
  'npx playwright install --with-deps chromium',
  'HARMONIARR_BROWSER_TEST_EVIDENCE_PATH: browser-test-evidence/harmoniarr-browser-test.json',
  'HARMONIARR_BROWSER_TEST_CLEANUP_WAIT_MS: 25000',
  'npm run test:browser',
  'node scripts/write-browser-test-evidence-summary.js',
  "if: always() && hashFiles('browser-test-evidence/harmoniarr-browser-test.json') != ''",
  'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  'if-no-files-found: warn',
  'retention-days: 14',
];

export function assertBrowserValidationWorkflowContract(workflowSource) {
  if (typeof workflowSource !== 'string' || workflowSource.trim() === '') {
    throw new Error('browser validation workflow source is required');
  }

  for (const fragment of requiredWorkflowFragments) {
    if (!workflowSource.includes(fragment)) {
      throw new Error(`browser validation workflow is missing required fragment: ${fragment}`);
    }
  }

  return true;
}
