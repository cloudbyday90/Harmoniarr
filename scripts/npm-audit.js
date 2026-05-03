/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runBufferedCommand } from './process-runtime.js';

function resolveNpmCommand(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

function buildSpawnCommand({ args, npmCommand, platform = process.platform }) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', npmCommand, ...args],
    };
  }

  return {
    command: npmCommand,
    args,
  };
}

function parseAuditOutput(stdout) {
  const normalized = stdout.trim();
  if (!normalized) {
    throw new Error('npm audit did not return JSON output');
  }

  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(`Unable to parse npm audit JSON output: ${error.message}`, { cause: error });
  }
}

function normalizeVulnerabilityCounts(report) {
  const counts = report?.metadata?.vulnerabilities ?? {};

  return {
    critical: Number(counts.critical ?? 0),
    high: Number(counts.high ?? 0),
    info: Number(counts.info ?? 0),
    low: Number(counts.low ?? 0),
    moderate: Number(counts.moderate ?? 0),
    total: Number(counts.total ?? 0),
  };
}

function summarizeTopPackages(report, severities = new Set(['critical', 'high'])) {
  const vulnerabilities = report?.vulnerabilities ?? {};

  return Object.entries(vulnerabilities)
    .filter(([, details]) => severities.has(details?.severity))
    .slice(0, 5)
    .map(([packageName, details]) => `${packageName} (${details.severity})`);
}

export async function runNpmAudit({
  args = ['audit', '--audit-level=high', '--json'],
  cwd = process.cwd(),
  env = process.env,
  npmCommand = resolveNpmCommand(),
  platform = process.platform,
  spawnFn,
} = {}) {
  const spawnCommand = buildSpawnCommand({ args, npmCommand, platform });
  const { exitCode, stderr, stdout } = await runBufferedCommand({
    args: spawnCommand.args,
    command: spawnCommand.command,
    cwd,
    env,
    expectedExitCodes: [0, 1],
    spawnFn,
  });
  const report = parseAuditOutput(stdout);
  const vulnerabilityCounts = normalizeVulnerabilityCounts(report);

  if (exitCode === 0) {
    return {
      vulnerabilityCounts,
    };
  }

  if (exitCode === 1) {
    const topPackages = summarizeTopPackages(report);
    const packageSummary = topPackages.length > 0
      ? ` Top affected packages: ${topPackages.join(', ')}.`
      : '';
    throw new Error(
      `npm audit reported ${vulnerabilityCounts.high} high and ${vulnerabilityCounts.critical} critical vulnerabilities.${packageSummary}`,
    );
  }

  const errorOutput = stderr.trim();
  throw new Error(
    `npm audit failed with exit code ${exitCode}${errorOutput ? `\n${errorOutput}` : ''}`,
  );
}
