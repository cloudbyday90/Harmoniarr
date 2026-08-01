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
import { buildMusicQueueAddRecoveryPresentation } from '../../shared/music-queue-add-recovery-presentation.js';

export function buildAcquisitionAddBlockerRepair(blockerCode, recoveryReasonCode = null) {
  const normalizedBlockerCode = normalizeImportCandidateAddBlockerCode(blockerCode);
  return buildMusicQueueAddRecoveryPresentation({
    blockerCode: normalizedBlockerCode ?? IMPORT_CANDIDATE_ADD_BLOCKER_CODES.UNSAFE_ADD_PLAN,
    recoveryReasonCode,
  });
}
