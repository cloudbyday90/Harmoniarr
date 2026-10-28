/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const folderProfileCases = Object.freeze({
  small: Object.freeze({ directories: 1000, files: 0 }),
  large: Object.freeze({ directories: 10_000, files: 0 }),
  mixed: Object.freeze({ directories: 1000, files: 9000 }),
  ceiling: Object.freeze({ directories: 50_000, files: 0 }),
});
export const folderProfileSources = Object.freeze(['filesystem/folder-browse-service.js', 'filesystem/folder-cursor-policy.js',
  'filesystem/folder-page-selector.js', 'api-error.js', '../shared/folder-browse-policy.js']);
export function assertProfileOwner(owner) {
  if (typeof owner !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(owner)) throw new TypeError('Invalid profile owner');
}
export function parseFolderProfileCommand(args) {
  const values = {}, allowed = new Set(['image', 'output', 'storage', 'scratch-root', 'cases', 'repeats']);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.slice(2), value = args[index + 1];
    if (!args[index]?.startsWith('--') || !allowed.has(key) || Object.hasOwn(values, key) || !value || value.startsWith('--')) throw new TypeError('Invalid folder profile options');
    values[key] = value;
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(values.image ?? '') || !values.output?.endsWith('.json')
    || !['volume', 'bind'].includes(values.storage) || (values.storage === 'bind') !== Boolean(values['scratch-root'])
    || /[,\r\n\0]/u.test(values['scratch-root'] ?? '')) throw new TypeError('Require immutable image, exclusive JSON output and explicit storage');
  const cases = (values.cases ?? 'small,large').split(','), repeats = Number(values.repeats ?? 3);
  if (!cases.length || new Set(cases).size !== cases.length || cases.some(name => !Object.hasOwn(folderProfileCases, name))
    || !Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new TypeError('Invalid profile cases or repetition count');
  return { image: values.image, output: values.output, storage: values.storage, scratchRoot: values['scratch-root'], cases, repeats };
}
export function createFolderProfilePlan({ cases, repeats }) {
  const rows = [];
  for (const caseName of cases) for (const pages of [1, 3]) for (let repeat = 0; repeat < repeats; repeat++) {
    for (const algorithm of repeat % 2 ? ['readdir', 'stream'] : ['stream', 'readdir']) rows.push({ caseName, pages, repeat, algorithm, observed: true });
  }
  if (cases.includes('large')) for (let repeat = 0; repeat < repeats; repeat++) {
    for (const algorithm of repeat % 2 ? ['readdir', 'stream'] : ['stream', 'readdir']) rows.push({ caseName: 'large', pages: 3, repeat, algorithm, observed: false });
  }
  return rows;
}
