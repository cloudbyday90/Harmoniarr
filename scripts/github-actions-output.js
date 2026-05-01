/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEntryName(name) {
  if (!isNonEmptyString(name)) {
    throw new Error('GitHub output entry name is required');
  }

  return name.trim();
}

function normalizeEntryValue(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  throw new Error('GitHub output entry value must be a string, number, boolean, bigint, null, or undefined');
}

function createHeredocMarker(name) {
  return `${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_${randomUUID().replace(/-/g, '_')}`;
}

export function formatGitHubOutputEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('entries must be an array');
  }

  const lines = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('each GitHub output entry must be an object');
    }

    const name = normalizeEntryName(entry.name);
    const value = normalizeEntryValue(entry.value);

    if (value.includes('\n')) {
      const marker = createHeredocMarker(name);
      lines.push(`${name}<<${marker}`, value, marker);
      continue;
    }

    lines.push(`${name}=${value}`);
  }

  return `${lines.join('\n')}\n`;
}

export async function appendGitHubOutputEntries(outputPath, entries) {
  if (!outputPath) {
    return;
  }

  await appendFile(outputPath, formatGitHubOutputEntries(entries), 'utf8');
}