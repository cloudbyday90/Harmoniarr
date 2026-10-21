/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { ref } from 'vue';
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';

export function useMetadataDetectionHistory({ localArtist, captureWorkspace, fetchDetectionEvents }) {
  const detectionEventsPageInfo = ref({ hasMore: false, nextCursor: null });
  const detectionEventsErrorMessage = ref('');
  const detectionEventsStatusMessage = ref('');
  const isLoadingMoreDetectionEvents = ref(false);
  const pageGate = createLatestRequestGate();

  function reset(pageInfo) {
    pageGate.invalidate();
    detectionEventsPageInfo.value = pageInfo ?? { hasMore: false, nextCursor: null };
    detectionEventsErrorMessage.value = '';
    detectionEventsStatusMessage.value = '';
    isLoadingMoreDetectionEvents.value = false;
  }

  async function loadMoreDetectionEvents() {
    if (!localArtist.value?.artist?.id || !detectionEventsPageInfo.value?.hasMore || isLoadingMoreDetectionEvents.value) return;
    const workspace = captureWorkspace();
    const page = pageGate.begin();
    const isCurrent = () => workspace.isCurrent() && page.isCurrent();
    const artistId = localArtist.value.artist.id;
    const before = detectionEventsPageInfo.value.nextCursor;
    isLoadingMoreDetectionEvents.value = true;
    detectionEventsErrorMessage.value = '';
    detectionEventsStatusMessage.value = 'Loading more history.';

    try {
      const result = await fetchDetectionEvents(artistId, { before, signal: page.signal });
      if (!isCurrent()) return;
      localArtist.value = {
        ...localArtist.value,
        detectionEvents: [...(localArtist.value.detectionEvents ?? []), ...(result.detectionEvents ?? [])],
      };
      detectionEventsPageInfo.value = result.pageInfo ?? { hasMore: false, nextCursor: null };
      const count = result.detectionEvents?.length ?? 0;
      const hasMore = Boolean(detectionEventsPageInfo.value.hasMore);
      const loaded = count === 0 ? 'No additional history entries were returned.' : `Loaded ${count} more history ${count === 1 ? 'entry' : 'entries'}.`;
      detectionEventsStatusMessage.value = loaded + (hasMore ? '' : ' All history loaded.');
      return { kind: 'loaded', hasMore, isCurrent };
    } catch (error) {
      if (!isCurrent()) return;
      detectionEventsStatusMessage.value = '';
      if (isAbortError(error)) return { kind: 'cancelled', isCurrent };
      detectionEventsErrorMessage.value = getErrorMessage(error, 'Loading more detection history failed');
      return { kind: 'failed', isCurrent };
    } finally {
      if (isCurrent()) isLoadingMoreDetectionEvents.value = false;
    }
  }

  return { detectionEventsPageInfo, detectionEventsErrorMessage, detectionEventsStatusMessage, isLoadingMoreDetectionEvents, loadMoreDetectionEvents, reset };
}
