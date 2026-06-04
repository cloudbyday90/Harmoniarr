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

import { ref } from 'vue';
import { useArtistMonitoring } from './useArtistMonitoring.js';
import {
  loadSavedAddArtistPolicyForm,
  saveAddArtistPolicyForm,
} from '../lib/add-artist-policy.js';

/**
 * Shared orchestration for the "add to monitored" policy dialog. Centralises the
 * modal open/candidate/error/submit lifecycle that previously lived inline in
 * DiscoverView so that every surface (Discover, Search, ...) drives the same
 * `AddArtistModal` flow through one auditable mutation path
 * (`useArtistMonitoring().addArtistWithPolicy`).
 *
 * Surface-specific follow-up (seeding the taste graph, refreshing a list, focus
 * management) is supplied per call via the `onAdded` hook so the composable stays
 * presentation-agnostic.
 *
 * @param {object} [options]
 * @param {ReturnType<typeof useArtistMonitoring>} [options.monitoring]
 *   Pre-instantiated monitoring composable. When omitted a fresh instance is
 *   created so the dialog can be used in isolation (e.g. tests).
 */
export function useAddArtistModal(options = {}) {
  const monitoring = options.monitoring ?? useArtistMonitoring();
  const { addArtistWithPolicy, isMonitored, isMonitoring } = monitoring;

  const addArtistModalOpen = ref(false);
  const addArtistCandidate = ref(null);
  const addArtistErrorMessage = ref('');
  const addArtistPolicyDefaults = ref(loadSavedAddArtistPolicyForm());
  const lastAddedArtistId = ref(null);

  function isCandidateSaving() {
    return Boolean(addArtistCandidate.value && isMonitoring(addArtistCandidate.value.id));
  }

  /**
   * Open the policy dialog for an artist. No-ops when the artist is missing an id
   * or already added. The added check defaults to `isMonitored` but accepts a
   * surface-specific predicate (e.g. Discover also treats taste-graph seeds as
   * added).
   */
  function openAddArtistModal(artist, isAlreadyAdded) {
    if (!artist?.id) {
      return;
    }
    const alreadyAdded = typeof isAlreadyAdded === 'function'
      ? isAlreadyAdded(artist.id)
      : isMonitored(artist.id);
    if (alreadyAdded) {
      return;
    }
    addArtistCandidate.value = artist;
    addArtistErrorMessage.value = '';
    addArtistModalOpen.value = true;
  }

  /** Close the dialog unless a save is still in flight for the candidate. */
  function closeAddArtistModal() {
    if (isCandidateSaving()) {
      return;
    }
    addArtistModalOpen.value = false;
    addArtistCandidate.value = null;
    addArtistErrorMessage.value = '';
  }

  /**
   * Persist the candidate with the chosen policy. On success, optionally stores
   * the policy as the new default, records the added id (for focus return), runs
   * the surface `onAdded` hook, then closes the dialog. On failure surfaces the
   * error message on the dialog.
   *
   * @param {object} policyForm Normalised policy form from `AddArtistModal`.
   * @param {object} [hooks]
   * @param {(artist: object, result: object) => void} [hooks.onAdded]
   * @returns {Promise<object|undefined>} The raw `addArtistWithPolicy` result.
   */
  async function submitAddArtist(policyForm, hooks = {}) {
    if (!addArtistCandidate.value) {
      return undefined;
    }
    const artist = addArtistCandidate.value;
    addArtistErrorMessage.value = '';
    const result = await addArtistWithPolicy(artist, policyForm);
    if (result?.success) {
      if (result.policy.useAsDefault) {
        addArtistPolicyDefaults.value = saveAddArtistPolicyForm(result.policy);
      }
      lastAddedArtistId.value = artist.id;
      if (typeof hooks.onAdded === 'function') {
        hooks.onAdded(artist, result);
      }
      closeAddArtistModal();
    } else if (result?.error) {
      addArtistErrorMessage.value = result.error.message
        ?? 'Could not add artist. Please try again.';
    }
    return result;
  }

  return {
    monitoring,
    isMonitored,
    isMonitoring,
    addArtistModalOpen,
    addArtistCandidate,
    addArtistErrorMessage,
    addArtistPolicyDefaults,
    lastAddedArtistId,
    openAddArtistModal,
    closeAddArtistModal,
    submitAddArtist,
  };
}
