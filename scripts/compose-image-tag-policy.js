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
  'compose.slskd-example.yaml',
];

const forbiddenFloatingTags = new Set([
  'canary',
  'edge',
  'latest',
  'main',
  'master',
  'nightly',
  'stable',
]);

function normalizeLineEnding(value) {
  return value.replace(/\r\n/g, '\n');
}

function extractImageReference(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function extractReferenceTag(imageReference) {
  const withoutDigest = imageReference.split('@', 1)[0];
  const lastSlashIndex = withoutDigest.lastIndexOf('/');
  const lastColonIndex = withoutDigest.lastIndexOf(':');

  if (lastColonIndex <= lastSlashIndex) {
    return null;
  }

  return withoutDigest.slice(lastColonIndex + 1);
}

function extractDefaultedVariableFallback(imageReference) {
  const match = imageReference.match(/^\$\{[^}:]+(?:(:-|-)(.+))\}$/);

  if (!match) {
    return null;
  }

  return match[2]?.trim() || '';
}

function validateImageReference(imageReference) {
  if (!imageReference) {
    return 'image reference is empty';
  }

  if (imageReference.includes('${')) {
    const fallbackReference = extractDefaultedVariableFallback(imageReference);

    if (!fallbackReference) {
      return 'image reference must stay directly pinned in Compose, not delegated to an unresolved variable';
    }

    if (fallbackReference.includes('${')) {
      return 'image reference fallback must resolve to a directly pinned image reference';
    }

    return validateImageReference(fallbackReference);
  }

  const hasDigest = imageReference.includes('@sha256:');
  const tag = extractReferenceTag(imageReference);

  if (!hasDigest && !tag) {
    return 'image reference must include an explicit version tag or digest';
  }

  if (tag && forbiddenFloatingTags.has(tag)) {
    return `image reference uses the floating tag ${tag}`;
  }

  return null;
}

export function findComposeImageTagViolations(relativePath, source) {
  const violations = [];
  const lines = normalizeLineEnding(source).split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\s*image:\s*(.+)\s*$/);
    if (!match) {
      continue;
    }

    const imageReference = extractImageReference(match[1]);
    const reason = validateImageReference(imageReference);
    if (!reason) {
      continue;
    }

    violations.push({
      imageReference,
      line: index + 1,
      reason,
      relativePath,
    });
  }

  return violations;
}

export async function checkComposeImageTagPolicy({
  composeFiles = defaultComposeFiles,
  readFileImpl = readFile,
  rootDir = process.cwd(),
} = {}) {
  const violations = [];

  for (const relativePath of composeFiles) {
    const source = await readFileImpl(resolve(rootDir, relativePath), 'utf8');
    violations.push(...findComposeImageTagViolations(relativePath, source));
  }

  if (violations.length > 0) {
    const lines = violations.map((violation) => {
      return `- ${violation.relativePath}:${violation.line} ${violation.reason} (${violation.imageReference})`;
    });
    throw new Error(`Compose image tag policy failed:\n${lines.join('\n')}`);
  }

  return {
    checkedFileCount: composeFiles.length,
  };
}