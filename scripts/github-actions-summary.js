/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { appendFile } from 'node:fs/promises';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createMarkdownBulletList(items, { emptyLine = '- none' } = {}) {
  const normalizedItems = Array.isArray(items)
    ? items.filter(isNonEmptyString).map((item) => item.trim())
    : [];

  if (normalizedItems.length === 0) {
    return emptyLine;
  }

  return normalizedItems.map((item) => `- ${item}`).join('\n');
}

export function formatGitHubStepSummary(lines) {
  if (!Array.isArray(lines)) {
    throw new Error('summary lines must be an array');
  }

  return `${lines.map((line) => (line == null ? '' : String(line))).join('\n')}\n`;
}

export async function appendGitHubStepSummary(summaryPath, lines) {
  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, formatGitHubStepSummary(lines), 'utf8');
}