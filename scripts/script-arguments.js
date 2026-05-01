/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { parseArgs } from 'node:util';

export function parseScriptArguments({
  allowNegative = false,
  allowPositionals = false,
  args = process.argv.slice(2),
  options = {},
  strict = true,
} = {}) {
  return parseArgs({
    allowNegative,
    allowPositionals,
    args,
    options,
    strict,
  });
}

export function getScriptPositionals(args = process.argv.slice(2)) {
  const { positionals } = parseScriptArguments({
    allowPositionals: true,
    args,
    options: {},
    strict: true,
  });

  return positionals;
}

export function getRequiredPositionalArgument(name, { args = process.argv.slice(2), index = 0 } = {}) {
  const value = getScriptPositionals(args)[index]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function joinPositionalArguments(args = process.argv.slice(2)) {
  return getScriptPositionals(args).join(' ').trim();
}