/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';

import { assessArtistDetailLocalTimingEvidence, renderArtistDetailLocalTimingAssessment } from './artist-detail-local-timing-assessment.js';
import { resolveBrowserTestEvidencePath } from './browser-test-evidence.js';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const artistDetailLocalTimingAssessmentCliOptions = Object.freeze({
  'evidence-path': { type: 'string' },
});

function getRequiredEvidencePath(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('evidence-path is required');
  }

  return value.trim();
}

export function resolveArtistDetailLocalTimingAssessmentInputs({
  args = process.argv.slice(2),
} = {}) {
  const { values } = parseStrictScriptOptions(artistDetailLocalTimingAssessmentCliOptions, { args });
  return Object.freeze({
    evidencePath: getRequiredEvidencePath(values['evidence-path']),
  });
}

export function parseArtistDetailLocalTimingEvidence(text) {
  if (typeof text !== 'string') {
    throw new Error('Artist Detail timing evidence must be valid JSON');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Artist Detail timing evidence must be valid JSON');
  }
}

function assertCanonicalEvidencePathWithinWorkspace({ evidencePath, workspacePath }) {
  const workspaceRelativePath = relative(workspacePath, evidencePath);
  if (workspaceRelativePath === ''
    || workspaceRelativePath === '..'
    || workspaceRelativePath.startsWith('..\\')
    || workspaceRelativePath.startsWith('../')
    || isAbsolute(workspaceRelativePath)) {
    throw new Error('Artist Detail timing evidence path must remain within the working directory');
  }

  return evidencePath;
}

export async function resolveArtistDetailLocalTimingEvidencePath({
  cwd = process.cwd(),
  evidencePath,
  realpathFn = realpath,
} = {}) {
  const resolvedEvidencePath = resolveBrowserTestEvidencePath(evidencePath, { cwd });

  let canonicalEvidencePath;
  let canonicalWorkspacePath;
  try {
    [canonicalEvidencePath, canonicalWorkspacePath] = await Promise.all([
      realpathFn(resolvedEvidencePath),
      realpathFn(cwd),
    ]);
  } catch {
    throw new Error('Artist Detail timing evidence could not be read');
  }

  return assertCanonicalEvidencePathWithinWorkspace({
    evidencePath: canonicalEvidencePath,
    workspacePath: canonicalWorkspacePath,
  });
}

export async function readArtistDetailLocalTimingEvidence({
  cwd = process.cwd(),
  evidencePath,
  readFileFn = readFile,
  realpathFn,
} = {}) {
  const resolvedEvidencePath = await resolveArtistDetailLocalTimingEvidencePath({
    cwd,
    evidencePath,
    realpathFn,
  });
  let text;
  try {
    text = await readFileFn(resolvedEvidencePath, 'utf8');
  } catch {
    throw new Error('Artist Detail timing evidence could not be read');
  }

  return parseArtistDetailLocalTimingEvidence(text);
}

export async function runArtistDetailLocalTimingAssessment({
  args = process.argv.slice(2),
  cwd = process.cwd(),
  readFileFn,
  realpathFn,
} = {}) {
  const { evidencePath } = resolveArtistDetailLocalTimingAssessmentInputs({ args });
  const evidence = await readArtistDetailLocalTimingEvidence({
    cwd,
    evidencePath,
    readFileFn,
    realpathFn,
  });
  return assessArtistDetailLocalTimingEvidence(evidence);
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-assess-artist-detail-local-timing',
  renderSuccessMessage: (output) => output,
  run: async () => {
    const { evidencePath } = resolveArtistDetailLocalTimingAssessmentInputs();
    const evidence = await readArtistDetailLocalTimingEvidence({ evidencePath });
    return renderArtistDetailLocalTimingAssessment(evidence);
  },
  stdoutStyle: 'raw',
});
