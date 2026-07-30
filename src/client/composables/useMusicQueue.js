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

import { computed, readonly, ref, toValue, watch } from 'vue';
import { useAsyncResource } from './useAsyncResource.js';
import {
  allowMusicQueueFallbackQuality as defaultAllowMusicQueueFallbackQuality,
  fetchMusicQueueReleases as defaultFetchMusicQueueReleases,
  rejectMusicQueueMatch as defaultRejectMusicQueueMatch,
  searchMusicQueueReleaseAgain as defaultSearchMusicQueueReleaseAgain,
  useMusicQueueMatch as defaultUseMusicQueueMatch,
} from '../lib/acquisition-api.js';
import { buildMusicQueueSummaryCards, normalizeMusicQueueRelease } from '../lib/acquisition-pipeline-presentation.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createMusicQueueActionFeedback } from '../lib/music-queue-action-feedback-presentation.js';
import {
  isMusicQueueActiveProgressRelease,
  MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES,
} from '../lib/music-queue-progress-state.js';

export { MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES };

/**
 * Keeps short-lived automatic work visible without continuously polling stable
 * releases that require no background UI update.
 *
 * @param {{ releases?: Array<{ status?: { code?: string }, statusCode?: string }> } | null | undefined} payload
 * @returns {boolean}
 */
export function hasActiveMusicQueueProgress(payload) {
  const releases = Array.isArray(payload?.releases) ? payload.releases : [];
  return releases.some(isMusicQueueActiveProgressRelease);
}

export function useMusicQueue({
  allowMusicQueueFallbackQuality = defaultAllowMusicQueueFallbackQuality,
  fetchMusicQueueReleases = defaultFetchMusicQueueReleases,
  immediate = true,
  limit = 100,
  metadataArtistId = null,
  pollIntervalMs = 10000,
  rejectMusicQueueMatch = defaultRejectMusicQueueMatch,
  searchMusicQueueReleaseAgain = defaultSearchMusicQueueReleaseAgain,
  useMusicQueueMatch = defaultUseMusicQueueMatch,
} = {}) {
  const actionFeedback = ref(null);
  const activeMatchActionKey = ref('');
  const activeReleaseActionKey = ref('');
  const hasArtistScope = metadataArtistId !== null;

  function getMetadataArtistId() {
    const value = toValue(metadataArtistId);
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  const resource = useAsyncResource({
    fallbackErrorMessage: 'Music Queue failed to load',
    fetcher: () => fetchMusicQueueReleases({
      limit,
      metadataArtistId: getMetadataArtistId(),
    }),
    immediate: hasArtistScope ? false : immediate,
    initialData: { pagination: { total: 0 }, releases: [], summary: { counts: {}, total: 0 } },
    pollIntervalMs,
    pollWhile: (payload) => (
      (!hasArtistScope || Boolean(getMetadataArtistId()))
      && hasActiveMusicQueueProgress(payload)
    ),
    project: (payload) => ({
      checkedAt: payload?.checkedAt ?? null,
      pagination: payload?.pagination ?? { total: 0 },
      releases: Array.isArray(payload?.releases) ? payload.releases.map(normalizeMusicQueueRelease) : [],
      summary: payload?.summary ?? { counts: {}, total: 0 },
    }),
    revalidateOnFocus: true,
  });

  if (hasArtistScope) {
    watch(getMetadataArtistId, (nextMetadataArtistId, previousMetadataArtistId) => {
      if (nextMetadataArtistId === previousMetadataArtistId && previousMetadataArtistId !== undefined) {
        return;
      }

      resource.reset();
      if (nextMetadataArtistId) {
        void resource.load();
      }
    }, { immediate: true });
  }

  const releases = computed(() => resource.data.value.releases ?? []);
  const summaryCards = computed(() => buildMusicQueueSummaryCards(resource.data.value.summary));
  const totalCount = computed(() => resource.data.value.pagination?.total ?? releases.value.length);

  function applyMutationRelease(payload) {
    const updatedRelease = normalizeMusicQueueRelease(payload?.release);
    if (!updatedRelease?.id || !Array.isArray(resource.data.value.releases)) {
      return;
    }

    let didReplace = false;
    const nextReleases = resource.data.value.releases.map((release) => {
      if (release.id !== updatedRelease.id) return release;
      didReplace = true;
      return updatedRelease;
    });

    if (didReplace) {
      resource.data.value = {
        ...resource.data.value,
        releases: nextReleases,
      };
    }
  }

  function setActionFeedback({ actionKey, message, phase, wantedReleaseId }) {
    actionFeedback.value = createMusicQueueActionFeedback({
      actionKey,
      message,
      phase,
      wantedReleaseId,
    });
  }

  async function runMatchAction({
    actionKey,
    apiFn,
    matchId,
    pendingMessage,
    successMessage,
    wantedReleaseId,
  }) {
    if (!wantedReleaseId || !matchId) {
      return null;
    }

    activeMatchActionKey.value = actionKey;
    setActionFeedback({ actionKey, message: pendingMessage, phase: 'working', wantedReleaseId });

    try {
      const payload = await apiFn({ matchId, wantedReleaseId });
      applyMutationRelease(payload);
      setActionFeedback({ actionKey, message: successMessage, phase: 'success', wantedReleaseId });
      await resource.load();
      return payload;
    } catch (error) {
      setActionFeedback({
        actionKey,
        message: getErrorMessage(error, 'Music Queue match action failed.') || 'Music Queue match action failed.',
        phase: 'error',
        wantedReleaseId,
      });
      return null;
    } finally {
      activeMatchActionKey.value = '';
    }
  }

  function useMatch({ matchId, wantedReleaseId } = {}) {
    return runMatchAction({
      actionKey: `${wantedReleaseId}:${matchId}:use`,
      apiFn: useMusicQueueMatch,
      matchId,
      pendingMessage: 'Using this match...',
      successMessage: 'Match selected. Harmoniarr will use it for the next download step.',
      wantedReleaseId,
    });
  }

  function rejectMatch({ matchId, wantedReleaseId } = {}) {
    return runMatchAction({
      actionKey: `${wantedReleaseId}:${matchId}:reject`,
      apiFn: rejectMusicQueueMatch,
      matchId,
      pendingMessage: 'Rejecting this match...',
      successMessage: 'Match rejected. Harmoniarr will not choose it for this release.',
      wantedReleaseId,
    });
  }

  async function searchAgain({ wantedReleaseId } = {}) {
    if (!wantedReleaseId) {
      return null;
    }

    const actionKey = `${wantedReleaseId}:search-again`;
    activeReleaseActionKey.value = actionKey;
    setActionFeedback({
      actionKey,
      message: 'Queuing another search...',
      phase: 'working',
      wantedReleaseId,
    });

    try {
      const payload = await searchMusicQueueReleaseAgain({ wantedReleaseId });
      applyMutationRelease(payload);
      setActionFeedback({
        actionKey,
        message: payload?.action?.dispatchAlreadyActive
          ? 'Search queued. Discovery is already running and will pick this up.'
          : 'Search queued. Harmoniarr will look for this release again.',
        phase: 'success',
        wantedReleaseId,
      });
      await resource.load();
      return payload;
    } catch (error) {
      setActionFeedback({
        actionKey,
        message: getErrorMessage(error, 'Music Queue search retry failed.') || 'Music Queue search retry failed.',
        phase: 'error',
        wantedReleaseId,
      });
      return null;
    } finally {
      activeReleaseActionKey.value = '';
    }
  }

  async function allowFallbackQuality({ wantedReleaseId } = {}) {
    if (!wantedReleaseId) {
      return null;
    }

    const actionKey = `${wantedReleaseId}:allow-fallback-quality`;
    activeReleaseActionKey.value = actionKey;
    setActionFeedback({
      actionKey,
      message: 'Saving the fallback-quality choice...',
      phase: 'working',
      wantedReleaseId,
    });

    try {
      const payload = await allowMusicQueueFallbackQuality({ wantedReleaseId });
      applyMutationRelease(payload);
      setActionFeedback({
        actionKey,
        message: payload?.action?.dispatchAlreadyActive
          ? 'Fallback quality allowed. Discovery is already running and will pick this up.'
          : 'Fallback quality allowed. Harmoniarr will look for an acceptable match.',
        phase: 'success',
        wantedReleaseId,
      });
      await resource.load();
      return payload;
    } catch (error) {
      setActionFeedback({
        actionKey,
        message: getErrorMessage(error, 'Music Queue fallback quality update failed.') || 'Music Queue fallback quality update failed.',
        phase: 'error',
        wantedReleaseId,
      });
      return null;
    } finally {
      activeReleaseActionKey.value = '';
    }
  }

  return {
    ...resource,
    actionFeedback: readonly(actionFeedback),
    activeMatchActionKey: readonly(activeMatchActionKey),
    activeReleaseActionKey: readonly(activeReleaseActionKey),
    allowFallbackQuality,
    rejectMatch,
    releases,
    searchAgain,
    summaryCards,
    totalCount,
    useMatch,
  };
}
