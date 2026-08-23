/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const defaultComposeFiles = [
  'compose.yaml',
  'compose.walkthrough.yaml',
];

function normalizeLineEnding(value) {
  return value.replace(/\r\n/g, '\n');
}

function findServiceBlock(source, serviceName) {
  const normalizedSource = normalizeLineEnding(source);
  const servicePattern = new RegExp(`^[ ]{2}${serviceName}:\\s*(?:#.*)?$`, 'm');
  const serviceMatch = servicePattern.exec(normalizedSource);

  if (!serviceMatch) {
    return null;
  }

  const blockStart = serviceMatch.index + serviceMatch[0].length;
  const followingServices = normalizedSource.slice(blockStart).search(/^[ ]{2}[A-Za-z0-9_-]+:\s*(?:#.*)?$/m);
  const blockEnd = followingServices === -1
    ? normalizedSource.length
    : blockStart + followingServices;

  return normalizedSource.slice(blockStart, blockEnd);
}

function findDeployBlock(serviceBlock) {
  const deployMatch = /^[ ]{4}deploy:\s*(?:#.*)?\n((?:^[ ]{6}.*\n?|^\s*$)*)/m.exec(serviceBlock);
  return deployMatch?.[1] ?? null;
}

function hasDeployValue(deployBlock, key, value) {
  const valuePattern = new RegExp(`^      ${key}:\\s*${value}\\s*(?:#.*)?$`, 'm');
  return valuePattern.test(deployBlock);
}

/**
 * The default image embeds PostgreSQL and binds its writable data paths from
 * one host. It is therefore intentionally a single-node Compose deployment.
 */
export function findComposeSingleNodeTopologyViolations(relativePath, source) {
  const serviceBlock = findServiceBlock(source, 'harmoniarr');

  if (!serviceBlock) {
    return [{
      reason: 'must define the harmoniarr service for single-node topology validation',
      relativePath,
    }];
  }

  const deployBlock = findDeployBlock(serviceBlock);
  const violations = [];

  if (!deployBlock) {
    violations.push({
      reason: 'harmoniarr must explicitly declare deploy.mode: replicated and deploy.replicas: 1',
      relativePath,
    });
    return violations;
  }

  if (!hasDeployValue(deployBlock, 'mode', 'replicated')) {
    violations.push({
      reason: 'harmoniarr deploy.mode must be replicated',
      relativePath,
    });
  }

  if (!hasDeployValue(deployBlock, 'replicas', '1')) {
    violations.push({
      reason: 'harmoniarr deploy.replicas must be 1 while the embedded PostgreSQL topology is in use',
      relativePath,
    });
  }

  return violations;
}

export async function checkComposeSingleNodeTopologyPolicy({
  composeFiles = defaultComposeFiles,
  readFileImpl = readFile,
  rootDir = process.cwd(),
} = {}) {
  const violations = [];

  for (const relativePath of composeFiles) {
    const source = await readFileImpl(resolve(rootDir, relativePath), 'utf8');
    violations.push(...findComposeSingleNodeTopologyViolations(relativePath, source));
  }

  if (violations.length > 0) {
    const lines = violations.map((violation) => `- ${violation.relativePath} ${violation.reason}`);
    throw new Error(`Compose single-node topology policy failed:\n${lines.join('\n')}`);
  }

  return {
    checkedFileCount: composeFiles.length,
  };
}
