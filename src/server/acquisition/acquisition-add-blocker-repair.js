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

import {
  IMPORT_CANDIDATE_ADD_BLOCKER_CODES,
  normalizeImportCandidateAddBlockerCode,
} from '../import-candidates/import-candidate-add-blocker.js';

const ADD_BLOCKER_REPAIRS = Object.freeze({
  [IMPORT_CANDIDATE_ADD_BLOCKER_CODES.ADD_FAILED]: Object.freeze({
    code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.ADD_FAILED,
    detail: 'Harmoniarr stopped while adding these files and left your library unchanged where it could not finish safely.',
    nextStep: 'Review the release, then open Advanced diagnostics if you need the file-by-file result.',
    title: 'Adding this release stopped safely',
  }),
  [IMPORT_CANDIDATE_ADD_BLOCKER_CODES.LIBRARY_COLLISION]: Object.freeze({
    code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.LIBRARY_COLLISION,
    detail: 'A file for this release already exists in your library, so Harmoniarr stopped before overwriting it.',
    nextStep: 'Review the release, then use Advanced diagnostics to decide how to handle the existing library file.',
    title: 'Existing library files need review',
  }),
  [IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION]: Object.freeze({
    code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.MEDIA_VERIFICATION,
    detail: 'Harmoniarr could not verify the downloaded audio safely, so it was not added to your library.',
    nextStep: 'Review the release quality details before changing the quality choice or searching again.',
    title: 'Audio verification needs review',
  }),
  [IMPORT_CANDIDATE_ADD_BLOCKER_CODES.SOURCE_PATH_UNAVAILABLE]: Object.freeze({
    code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.SOURCE_PATH_UNAVAILABLE,
    detail: 'Harmoniarr cannot reach the completed download from its configured folders.',
    nextStep: 'Check the download and library folder setup. Harmoniarr will keep the library unchanged until the files are reachable.',
    settingsRouteName: 'settings-media-storage',
    settingsRouteLabel: 'Set up folders',
    title: 'Completed files are not reachable',
  }),
  [IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN]: Object.freeze({
    code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN,
    detail: 'Harmoniarr stopped before changing your library because the safe add plan needs review.',
    nextStep: 'Review the release, then open Advanced diagnostics for the files or saved decisions that need attention.',
    title: 'Safe add plan needs review',
  }),
});

const DEFAULT_ADD_BLOCKER_REPAIR = Object.freeze({
  code: IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN,
  detail: 'Harmoniarr stopped before changing your library because the completed download needs a safe add review.',
  nextStep: 'Review the release, then open Advanced diagnostics if you need the detailed add plan.',
  title: 'Adding this release needs review',
});

export function buildAcquisitionAddBlockerRepair(blockerCode) {
  const normalizedBlockerCode = normalizeImportCandidateAddBlockerCode(blockerCode);
  return ADD_BLOCKER_REPAIRS[normalizedBlockerCode] ?? DEFAULT_ADD_BLOCKER_REPAIR;
}
