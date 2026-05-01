/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendGitHubStepSummary } from './github-actions-summary.js';
import { getRequiredPositionalArgument } from './script-arguments.js';
import { runDirectScriptTask } from './script-runtime.js';
import { resolveContainerMaintenanceSummaryInputs } from './workflow-summary-inputs.js';

const containerMaintenanceSummaryKinds = Object.freeze({
  dockerHubSkip: 'dockerhub-skip',
  ghcrActive: 'ghcr-active',
  ghcrPreview: 'ghcr-preview',
});

export function renderGhcrPreviewSummaryLines({ keepCount, packageName } = {}) {
  return [
    '## GHCR Maintenance',
    '',
    '- Dry run requested; untagged GHCR cleanup skipped.',
    `- Package: ${packageName}`,
    `- Untagged versions to keep: ${keepCount}`,
    '',
  ];
}

export function renderGhcrActiveSummaryLines({ keepCount, packageName } = {}) {
  return [
    '## GHCR Maintenance',
    '',
    `- Package: ${packageName}`,
    `- Untagged versions retained: ${keepCount}`,
    '- Cleanup mode: active',
    '',
  ];
}

export function renderDockerHubSkipSummaryLines() {
  return [
    '## Docker Hub Maintenance',
    '',
    '- Docker Hub credentials are not configured for this repository.',
    '- Cleanup skipped.',
    '',
  ];
}

export async function writeContainerMaintenanceSummary(summaryKind, {
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const inputs = resolveContainerMaintenanceSummaryInputs(summaryKind, { args, env });

  switch (summaryKind) {
    case containerMaintenanceSummaryKinds.ghcrPreview:
      return appendGitHubStepSummary(inputs.summaryPath, renderGhcrPreviewSummaryLines(inputs));
    case containerMaintenanceSummaryKinds.ghcrActive:
      return appendGitHubStepSummary(inputs.summaryPath, renderGhcrActiveSummaryLines(inputs));
    case containerMaintenanceSummaryKinds.dockerHubSkip:
      return appendGitHubStepSummary(inputs.summaryPath, renderDockerHubSkipSummaryLines());
    default:
      throw new Error(`Unsupported container maintenance summary kind: ${summaryKind}`);
  }
}

function getSummaryKind() {
  return getRequiredPositionalArgument('container maintenance summary kind');
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-container-maintenance-summary',
  renderSuccessMessage: () => `Workflow summary written for ${getSummaryKind()}`,
  run: () => writeContainerMaintenanceSummary(getSummaryKind()),
  stdoutStyle: 'raw',
});