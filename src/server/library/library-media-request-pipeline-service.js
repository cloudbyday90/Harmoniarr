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

import { createLibraryMediaRequestPipelineStore } from './library-media-request-pipeline-store.js';
import { buildMediaRequestTransferProgress } from './library-media-request-transfer-progress.js';

export function createLibraryMediaRequestPipelineService({
  getReadableMediaRequest = async () => {
    throw new Error('getReadableMediaRequest dependency is required');
  },
  pipelineStore = createLibraryMediaRequestPipelineStore(),
} = {}) {
  async function buildPipeline({
    actorUserId,
    actorUserRole,
    mediaRequestId,
  }) {
    if (!mediaRequestId) {
      return { candidates: [] };
    }

    await getReadableMediaRequest({
      actorUserId,
      actorUserRole,
      mediaRequestId,
    });

    const candidates = await pipelineStore.listPipelineCandidates({ mediaRequestId });

    return {
      candidates: candidates.map((candidate) => {
        const execution = candidate.execution
          ? {
              operationRunId: candidate.execution.operationRunId,
              importCandidateId: candidate.execution.importCandidateId,
              itemStatus: candidate.execution.itemStatus,
              statusMessage: candidate.execution.statusMessage,
              startedAt: candidate.execution.startedAt,
              finishedAt: candidate.execution.finishedAt,
              runStatus: candidate.execution.runStatus,
              runErrorMessage: candidate.execution.runErrorMessage,
            }
          : null;

        return {
          ...candidate,
          execution,
          transferProgress: buildMediaRequestTransferProgress(
            candidate.execution?.planningSnapshot,
          ),
        };
      }),
    };
  }

  return { buildPipeline };
}
