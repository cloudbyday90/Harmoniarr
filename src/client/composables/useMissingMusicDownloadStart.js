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

import { startMissingMusicDecisionDownload as defaultStartMissingMusicDecisionDownload } from '../lib/missing-music-api.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

export function useMissingMusicDownloadStart(options = {}) {
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:start-download`,
    executeMutation: options.startMissingMusicDecisionDownload ?? defaultStartMissingMusicDecisionDownload,
    fallbackErrorMessage: 'The download could not be started. Refresh this release and try again.',
    pendingMessage: 'Starting download preparation…',
    scope: 'missing-music.decisions.download.start',
    successMessage: 'Download preparation started. Transfer progress will appear in Downloader after it is submitted.',
  });
  return {
    clearFeedback: mutation.clearFeedback,
    errorMessage: mutation.errorMessage,
    isStarting: mutation.isPending,
    startDownload: mutation.run,
    statusMessage: mutation.statusMessage,
  };
}
