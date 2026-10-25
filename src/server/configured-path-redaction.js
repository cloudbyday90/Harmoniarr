/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export function collectConfiguredPathRoots(settings, appDataPath) {
  const paths = settings?.paths;
  return [appDataPath, paths?.downloads, paths?.music, paths?.staging, paths?.transcodeTemp,
    ...(Array.isArray(paths?.downloadMappings)
      ? paths.downloadMappings.flatMap(entry => [entry?.slskdPrefix, entry?.harmoniarrPrefix]) : [])];
}

function compileRoot(value) {
  if (typeof value !== 'string' || Array.from(value).some(char => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)) return null;
  const trimmed = value.trim();
  const windows = /^[A-Za-z]:[/\\]/u.test(trimmed) || /^[/\\]{2}[^/\\]+[/\\][^/\\]+/u.test(trimmed);
  const normalized = windows ? trimmed.replaceAll('\\', '/') : trimmed;
  const root = normalized.replace(/\/+$/u, '');
  if (!root || (!windows && (!root.startsWith('/') || root.startsWith('//')))) return null;
  // Configuration is literal data; no root can introduce regex operators.
  const literal = root.split('/').map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join(windows ? '[/\\\\]' : '/');
  return { root, pattern: new RegExp(`${literal}(?=$|[/\\\\\\s'"\x60,;:)\\]}<>|])`, windows ? 'gi' : 'g') };
}

function isPublicToken(text, index) {
  let start = index;
  while (start > 0 && !/[\s'"\x60()[\]{}<>]/u.test(text[start - 1])) start--;
  const token = text.slice(start, index + 3);
  // URL query values can contain literal filesystem-looking text as well.
  return token.includes('://') || (start < index && token.startsWith('//'))
    || /^\/api(?:\/|[?#]|$)/u.test(text.slice(start));
}

function findPathEnd(text, rootStart, rootEnd) {
  if (!/[/\\]/u.test(text[rootEnd] ?? '')) return rootEnd;
  const quote = /['"\x60]/u.test(text[rootStart - 1] ?? '') ? text[rootStart - 1] : null;
  let end = rootEnd;
  // Spaces are legal in paths. Conservatively remove the entire ambiguous tail
  // until a message delimiter, rather than exposing its remaining components.
  while (end < text.length && !(quote
    ? text[end] === quote || /[\r\n\t]/u.test(text[end])
    : /["\x60,;\r\n\t)\]}<>|]/u.test(text[end]))) end++;
  return end;
}

export function createConfiguredPathRedactor(roots = []) {
  const matchers = [...new Set(roots.filter(value => typeof value === 'string'))]
    .map(compileRoot).filter(Boolean).sort((a, b) => b.root.length - a.root.length);

  return function redactConfiguredPaths(value) {
    let text = value;
    for (const { pattern } of matchers) {
      pattern.lastIndex = 0;
      const spans = [];
      for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        const start = match.index;
        if ((start > 0 && !/[\s'"\x60([{=>:]/u.test(text[start - 1])) || isPublicToken(text, start)) continue;
        const end = findPathEnd(text, start, start + match[0].length);
        spans.push({ start, end });
        pattern.lastIndex = end;
      }
      const parts = []; let offset = 0;
      for (const { start, end } of spans) {
        parts.push(text.slice(offset, start), '[REDACTED_PATH]'); offset = end;
      }
      parts.push(text.slice(offset)); text = parts.join('');
    }
    return text;
  };
}
