/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { access, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertProfileOwner, folderProfileCases } from './folder-profile-policy.js';
import { folderProfileDirectoryName, folderProfileName } from './folder-profile-names.js';

export { folderProfileName };
function fixturePath(parent, owner) { assertProfileOwner(owner); return join(parent, owner); }
async function assertDirectory(path) {
  if (!(await lstat(path)).isDirectory() || await realpath(path) !== path) throw new Error('Refuse noncanonical fixture directory');
}
export async function readFolderProfileFixture({ parent, owner, ready = true }) {
  const root = fixturePath(parent, owner); await assertDirectory(root);
  const marker = join(root, '.fixture.json');
  if (!(await lstat(marker)).isFile() || (await lstat(marker)).size > 4096) throw new Error('Invalid fixture ownership marker');
  const data = JSON.parse(await readFile(marker, 'utf8'));
  if (data.owner !== owner || data.version !== 1 || !Array.isArray(data.cases) || data.cases.some(name => !Object.hasOwn(folderProfileCases, name))) throw new Error('Fixture ownership mismatch');
  if (ready) { const completion = JSON.parse(await readFile(join(root, '.ready.json'), 'utf8')); if (completion.owner !== owner) throw new Error('Fixture is incomplete'); }
  return { root, cases: data.cases };
}
export async function prepareFolderProfileFixture({ parent, owner, cases }) {
  if (!cases.length || cases.some(name => !Object.hasOwn(folderProfileCases, name))) throw new TypeError('Invalid fixture cases');
  const root = fixturePath(parent, owner); await mkdir(root); await assertDirectory(root);
  await writeFile(join(root, '.fixture.json'), JSON.stringify({ version: 1, owner, cases }), { flag: 'wx', mode: 0o644 });
  for (const name of cases) {
    const path = join(root, name), profile = folderProfileCases[name]; await mkdir(path);
    const count = profile.directories + profile.files;
    // A fixed-size producer batch is outside the measured consumer window.
    for (let offset = 0; offset < count; offset += 16) await Promise.all(Array.from({ length: Math.min(16, count - offset) }, (_, step) => {
      const index = offset + step;
      return index < profile.directories ? mkdir(join(path, folderProfileDirectoryName(profile, index)))
        : writeFile(join(path, 'file-' + String(index).padStart(5, '0')), '', { flag: 'wx' });
    }));
  }
  await writeFile(join(root, '.ready.json'), JSON.stringify({ owner }), { flag: 'wx', mode: 0o644 });
  return { prepared: true, cases };
}
export async function resolveFolderProfileCase({ parent, owner, caseName }) {
  const fixture = await readFolderProfileFixture({ parent, owner });
  if (!fixture.cases.includes(caseName)) throw new TypeError('Case was not prepared');
  const path = join(fixture.root, caseName); await assertDirectory(path); return path;
}
/** Only after prior consumers retire; the following read-only scan must refuse. */
export async function seedFolderProfileOverflow({ parent, owner, caseName }) {
  const profile = folderProfileCases[caseName];
  if (profile?.directories !== 50_000 || profile.files !== 0) throw new TypeError('Require an exact ceiling fixture');
  const path = await resolveFolderProfileCase({ parent, owner, caseName });
  await writeFile(join(path, 'profile-overflow-file'), '', { flag: 'wx', mode: 0o644 });
  return { overflowSeeded: true, caseName, extraOrdinaryFiles: 1 };
}
export async function removeFolderProfileFixture({ parent, owner }) {
  const root = fixturePath(parent, owner);
  try { await lstat(root); } catch (error) { if (error.code === 'ENOENT') return { ownedFixtureRemoved: true, alreadyAbsent: true }; throw error; }
  await readFolderProfileFixture({ parent, owner, ready: false });
  if (dirname(root) !== parent || await realpath(root) !== root) throw new Error('Refuse unowned fixture cleanup');
  await rm(root, { recursive: true, force: false });
  try { await access(root); throw new Error('Fixture still exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ownedFixtureRemoved: true };
}
