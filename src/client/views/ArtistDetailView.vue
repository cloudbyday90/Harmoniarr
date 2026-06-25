<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import ReleaseDetailModal from '../components/media/ReleaseDetailModal.vue';
import ArtistDetailRelatedArtistCard from '../components/media/ArtistDetailRelatedArtistCard.vue';
import ArtistReleaseSectionGrid from '../components/media/ArtistReleaseSectionGrid.vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useArtistDetail } from '../composables/useArtistDetail.js';
import { useArtistDetailArtwork } from '../composables/useArtistDetailArtwork.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import {
  addArtistAcquisitionProfileOptions,
  addArtistContentTypeOptions,
  addArtistReleaseScopeOptions,
  addArtistWantedAutomationOptions,
} from '../lib/add-artist-policy.js';
import {
  buildArtistDetailLocation,
  groupReleaseGroupsByType,
  normalizeReleaseGroupForCard,
} from '../lib/artist-detail-route.js';
import {
  buildArtistDetailErrorBody,
  buildArtistHeroBackgroundStyle,
  buildArtistMetaLine,
  buildArtistMusicBrainzLabel,
  buildArtistMusicBrainzUrl,
  buildNoDiscographyBody,
  formatArtistDetailError,
  formatDiscographyError,
  formatRelatedArtistScore,
  pluralizeReleaseType,
} from '../lib/artist-detail-presentation.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { saveOperatorArtistDraft } from '../lib/metadata-api.js';
import {
  buildOperatorArtistSaveDraft,
  createOperatorArtistDetailDraft,
  describeReleaseGroupOverride,
  fingerprintOperatorArtistDraft,
  getDraftReleaseGroupSelectionState,
  setDraftReleaseGroupSelectionState,
  setDraftTrackOverrideState,
} from '../lib/operator-artist-detail-draft.js';
import {
  calculateOperatorArtistCoveragePercent,
  formatOperatorArtistActivityLine,
  formatOperatorArtistCoverageLine,
} from '../lib/operator-artist-card-presentation.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();

const mbid = computed(() => String(route.params.mbid ?? ''));
const nameHint = computed(() => String(route.query.name ?? ''));

const {
  artist,
  operator,
  projection,
  releaseGroups,
  relatedArtists,
  isLoading,
  isMonitored,
  artistError,
  discographyError,
  relatedError,
  loadArtistDetail,
  setOperatorProjection,
} = useArtistDetail();

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
  if (isAdmin.value) {
    void loadRequestForUsers();
  }
}

function closeConfirmModal() {
  if (!isRequesting(confirmRelease.value)) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    confirmError.value = null;
  }
}

const confirmIsRequesting = computed(() =>
  (confirmRelease.value ? isRequesting(confirmRelease.value) : false),
);

const confirmIsRequested = computed(() =>
  (confirmRelease.value ? isRequested(confirmRelease.value) : false),
);

async function handleConfirmRequest({ requestedForUserId = null } = {}) {
  if (!confirmRelease.value) {
    return;
  }

  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value, { requestedForUserId });
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

const detailModalOpen = ref(false);
const detailRelease = ref(null);
const policyDraft = ref(createOperatorArtistDetailDraft());
const savedDraftFingerprint = ref(fingerprintOperatorArtistDraft(policyDraft.value));
const isSavingPolicy = ref(false);
const policySaveError = ref('');

function openDetailModal(release) {
  detailRelease.value = release;
  detailModalOpen.value = true;
}

function closeDetailModal() {
  detailModalOpen.value = false;
  detailRelease.value = null;
}

const artistName = computed(() => (artist.value?.name ?? nameHint.value) || 'Artist');
const artistMeta = computed(() => buildArtistMetaLine(artist.value));
const musicBrainzUrl = computed(() => buildArtistMusicBrainzUrl(mbid.value));
const canEditOperatorPolicy = computed(() => Boolean(projection.value?.artist?.id && operator.value));
const isPolicyDirty = computed(() =>
  fingerprintOperatorArtistDraft(policyDraft.value) !== savedDraftFingerprint.value,
);
const isPolicyFormValid = computed(() =>
  policyDraft.value.monitoring.monitoredReleaseGroupTypes.length > 0,
);
const operatorCoverage = computed(() => operator.value?.coverage ?? {});
const operatorOverview = computed(() => operator.value?.overview ?? {});
const operatorReconciliation = computed(() => operator.value?.reconciliation ?? {});
const coveragePercent = computed(() => calculateOperatorArtistCoveragePercent(operatorCoverage.value));

const discographySections = computed(() =>
  groupReleaseGroupsByType(releaseGroups.value).map((section) => ({
    releaseCount: section.items.length,
    type: section.type,
    releases: section.items.map((releaseGroup) => ({
      ...normalizeReleaseGroupForCard(releaseGroup),
      sourceReleaseGroup: releaseGroup,
    })),
  })),
);

const hasDiscography = computed(() => releaseGroups.value.length > 0);
const isArtistMonitored = computed(() => isMonitored.value);
const discographyReleaseCount = computed(() => releaseGroups.value.length);
const discographySectionCount = computed(() => discographySections.value.length);

const {
  getRelatedArtwork,
  getReleaseArtwork,
  heroBackgroundUrl,
  heroThumbnailUrl,
  isRefreshingArtwork,
  loadArtistArtwork,
} = useArtistDetailArtwork({
  artistMbid: mbid,
  discographySections,
  relatedArtists,
});

const heroStyle = computed(() => buildArtistHeroBackgroundStyle(heroBackgroundUrl.value));

const overviewCards = computed(() => ([
  {
    body: isArtistMonitored.value
      ? formatOperatorArtistActivityLine(operatorReconciliation.value)
      : 'Add this artist from Discover to route future releases into the monitored workflow.',
    label: 'Status',
    value: isArtistMonitored.value ? 'Monitored' : 'Available',
  },
  {
    body: hasDiscography.value
      ? formatOperatorArtistCoverageLine(operatorCoverage.value)
      : 'The discography panel will populate here once release groups are available.',
    label: 'Coverage',
    value: `${coveragePercent.value}%`,
  },
  {
    body: operatorOverview.value.hasManualOverrides
      ? `${operatorOverview.value.manualSelectionCount ?? 0} release overrides and ${operatorOverview.value.trackOverrideCount ?? 0} track overrides are saved.`
      : 'Broad policy controls this artist without local release or track exceptions.',
    label: 'Overrides',
    value: String(operatorOverview.value.trackOverrideCount ?? operatorOverview.value.manualSelectionCount ?? 0),
  },
]));

function buildRelatedArtistLocation(relatedArtist) {
  return buildArtistDetailLocation(relatedArtist.id, relatedArtist.name);
}

function buildRelatedSupportingText(relatedArtist) {
  if (typeof relatedArtist?.score === 'number' && relatedArtist.score >= 0.9) {
    return 'Strong similarity signal from MusicBrainz recommendations.';
  }

  return 'Open this artist to compare discography and recommendation context.';
}

function resetPolicyDraft() {
  policyDraft.value = createOperatorArtistDetailDraft(projection.value);
  savedDraftFingerprint.value = fingerprintOperatorArtistDraft(policyDraft.value);
  policySaveError.value = '';
}

function updateDraftReleaseGroupSelection(release, selectionState) {
  setDraftReleaseGroupSelectionState(
    policyDraft.value,
    release.sourceReleaseGroup,
    selectionState,
  );
}

function updateDraftTrackOverride({ medium, overrideState, release, releaseGroup, track }) {
  setDraftTrackOverrideState(
    policyDraft.value,
    releaseGroup,
    track,
    overrideState,
    {
      mediumPosition: medium?.position ?? null,
      metadataReleaseId: release?.id ?? null,
    },
  );
}

async function savePolicyDraft() {
  if (!canEditOperatorPolicy.value || !isPolicyFormValid.value || isSavingPolicy.value) {
    return;
  }

  isSavingPolicy.value = true;
  policySaveError.value = '';

  try {
    const payload = await saveOperatorArtistDraft(
      projection.value.artist.id,
      buildOperatorArtistSaveDraft(policyDraft.value),
    );
    if (payload?.projection) {
      setOperatorProjection(payload.projection);
    } else if (payload?.artist && payload?.operator) {
      setOperatorProjection(payload);
    } else {
      await loadArtistDetail(mbid.value);
    }
  } catch (error) {
    policySaveError.value = getErrorMessage(error, 'Saving artist policy failed.');
  } finally {
    isSavingPolicy.value = false;
  }
}

watch(mbid, (nextMbid) => {
  if (nextMbid) {
    void loadArtistDetail(nextMbid);
  }
}, { immediate: true });

watch(projection, () => {
  resetPolicyDraft();
});
</script>

<template>
  <section class="hx-page artist-detail-page">
    <article v-if="isLoading" class="hx-card artist-detail-loading" aria-live="polite" aria-busy="true">
      <div class="hx-card-body">
        <p class="artist-detail-loading__title">Loading artist detail...</p>
        <p class="artist-detail-loading__body">Discography, artwork, and related artists are being prepared.</p>
      </div>
    </article>

    <EmptyState
      v-else-if="discographyError && !artist && !nameHint"
      :title="formatDiscographyError(discographyError)"
      :body="buildArtistDetailErrorBody()"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </template>
    </EmptyState>

    <template v-else>
      <article class="hx-card artist-stage" :style="heroStyle">
        <div class="hx-card-body artist-stage__body">
          <div class="artist-stage__media">
            <img
              v-if="heroThumbnailUrl"
              :src="heroThumbnailUrl"
              :alt="`${artistName} artwork`"
              class="artist-stage__thumb"
              loading="lazy"
            />
            <div v-else class="artist-stage__thumb artist-stage__thumb--placeholder" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          </div>

          <div class="artist-stage__content">
            <span class="artist-stage__eyebrow">Artist Profile</span>
            <h1 class="hx-page-title artist-stage__title">{{ artistName }}</h1>
            <p v-if="artistMeta" class="artist-stage__meta">{{ artistMeta }}</p>
            <p class="artist-stage__copy">
              Review the artist’s current release map, decide what to request, and keep nearby recommendations close
              without leaving the metadata workflow.
            </p>
            <div class="artist-stage__signals">
              <span class="hx-pill" :data-tone="isArtistMonitored ? 'success' : 'info'">
                {{ isArtistMonitored ? 'Monitored artist' : 'Not monitored yet' }}
              </span>
              <span class="hx-pill" data-tone="info">
                {{ discographySectionCount }} section{{ discographySectionCount === 1 ? '' : 's' }}
              </span>
              <span v-if="isRefreshingArtwork" class="hx-pill" data-tone="warning">Refreshing artwork</span>
            </div>
            <div class="artist-stage__actions">
              <a
                v-if="musicBrainzUrl"
                :href="musicBrainzUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hx-btn"
                data-variant="ghost"
              >
                {{ buildArtistMusicBrainzLabel() }}
              </a>
              <button
                type="button"
                class="hx-btn hx-btn-icon"
                data-variant="ghost"
                :disabled="isRefreshingArtwork"
                aria-label="Refresh artwork"
                title="Refresh artwork"
                @click="loadArtistArtwork(true)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" :class="{ 'is-spinning': isRefreshingArtwork }" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3.2-6.8" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
            </div>
          </div>

          <section class="artist-stage__summary" aria-label="Artist overview">
            <article v-for="card in overviewCards" :key="card.label" class="artist-stage__summary-card">
              <span class="artist-stage__summary-label">{{ card.label }}</span>
              <strong class="artist-stage__summary-value">{{ card.value }}</strong>
              <p class="artist-stage__summary-body">{{ card.body }}</p>
            </article>
          </section>
        </div>
      </article>

      <p v-if="artistError" class="artist-detail-soft-error" role="alert">
        {{ formatArtistDetailError(artistError) }}
      </p>

      <article v-if="canEditOperatorPolicy" class="hx-card artist-policy-card" aria-label="Artist policy">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Artist Policy</h2>
            <p class="hx-card-subtitle">
              Update broad monitoring rules and release-level overrides before queueing the next reconciliation.
            </p>
          </div>
          <div class="hx-card-actions artist-policy-card__actions">
            <span
              class="hx-pill"
              :data-tone="isPolicyDirty ? 'warning' : 'success'"
            >
              {{ isPolicyDirty ? 'Unsaved changes' : 'Saved' }}
            </span>
            <button
              type="button"
              class="hx-btn"
              data-variant="ghost"
              :disabled="!isPolicyDirty || isSavingPolicy"
              @click="resetPolicyDraft"
            >
              Cancel
            </button>
            <button
              type="button"
              class="hx-btn"
              data-variant="primary"
              :disabled="!isPolicyDirty || !isPolicyFormValid || isSavingPolicy"
              @click="savePolicyDraft"
            >
              {{ isSavingPolicy ? 'Saving...' : 'Save policy' }}
            </button>
          </div>
        </header>

        <div class="hx-card-body artist-policy-card__body">
          <p v-if="policySaveError" class="artist-detail-soft-error" role="alert">
            {{ policySaveError }}
          </p>
          <p v-if="!isPolicyFormValid" class="artist-detail-soft-error" role="alert">
            Select at least one release type before saving.
          </p>

          <label class="artist-policy-card__monitor-toggle">
            <input
              v-model="policyDraft.monitoring.isMonitored"
              type="checkbox"
              :disabled="isSavingPolicy"
            />
            <span>
              <strong>Monitor this artist</strong>
              <small>Disabling monitoring clears saved release and track overrides on save.</small>
            </span>
          </label>

          <fieldset class="artist-policy-card__fieldset" :disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored">
            <legend>Content to track</legend>
            <div class="artist-policy-card__checkbox-grid">
              <label
                v-for="option in addArtistContentTypeOptions"
                :key="option.value"
                class="artist-policy-card__checkbox"
              >
                <input
                  v-model="policyDraft.monitoring.monitoredReleaseGroupTypes"
                  type="checkbox"
                  :value="option.value"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </fieldset>

          <div class="artist-policy-card__grid">
            <label>
              <span>Release scope</span>
              <select
                v-model="policyDraft.monitoring.releaseScope"
                class="hx-select"
                :disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored"
              >
                <option
                  v-for="option in addArtistReleaseScopeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label>
              <span>Acquisition profile</span>
              <select
                v-model="policyDraft.monitoring.acquisitionProfileKey"
                class="hx-select"
                :disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored"
              >
                <option
                  v-for="option in addArtistAcquisitionProfileOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label>
              <span>Wanted automation</span>
              <select
                v-model="policyDraft.monitoring.wantedAutomationMode"
                class="hx-select"
                :disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored"
              >
                <option
                  v-for="option in addArtistWantedAutomationOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </article>

      <article class="hx-card artist-detail-section-card" aria-label="Discography">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Discography</h2>
            <p class="hx-card-subtitle">
              {{ hasDiscography ? `${discographyReleaseCount} release groups across ${discographySectionCount} sections.` : 'Release groups appear here when they are available.' }}
            </p>
          </div>
        </header>

        <div class="hx-card-body artist-detail-section-card__body">
          <p v-if="discographyError" class="artist-detail-soft-error" role="alert">
            {{ formatDiscographyError(discographyError) }}
          </p>

          <EmptyState
            v-else-if="!hasDiscography"
            title="No releases found"
            :body="buildNoDiscographyBody()"
          />

          <div v-else class="artist-detail-discography">
            <section
              v-for="section in discographySections"
              :key="section.type"
              class="artist-detail-discography__section"
            >
              <div class="artist-detail-discography__header">
                <div>
                  <h3 class="artist-detail-discography__title">{{ pluralizeReleaseType(section.type) }}</h3>
                  <p class="artist-detail-discography__meta">{{ section.releaseCount }} release{{ section.releaseCount === 1 ? '' : 's' }}</p>
                </div>
              </div>

              <ArtistReleaseSectionGrid
                class="artist-detail-grid"
                :releases="section.releases"
                :aria-label="`${section.type}s`"
              >
                <template #default="{ release }">
                <ReleaseCard
                  :release="release"
                  :requested="isRequested(release)"
                  :requesting="isRequesting(release)"
                  :local-src="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.url ?? null"
                  :dominant-color="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.dominantColor ?? null"
                  :artwork-asset-id="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.assetId ?? null"
                  @request="openConfirmModal"
                  @detail="openDetailModal"
                >
                  <template v-if="canEditOperatorPolicy" #actions>
                    <div class="artist-detail-selection">
                      <select
                        class="hx-select artist-detail-selection__select"
                        :value="getDraftReleaseGroupSelectionState(policyDraft, release.sourceReleaseGroup)"
                        :disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored"
                        :aria-label="`Selection state for ${release.title ?? 'release group'}`"
                        @change="updateDraftReleaseGroupSelection(release, $event.target.value)"
                      >
                        <option value="selected">Selected</option>
                        <option value="partial">Partial</option>
                        <option value="unselected">Unselected</option>
                      </select>
                      <span class="artist-detail-selection__note">
                        {{ describeReleaseGroupOverride(policyDraft, release.sourceReleaseGroup) }}
                      </span>
                    </div>
                  </template>
                </ReleaseCard>
                </template>
              </ArtistReleaseSectionGrid>
            </section>
          </div>
        </div>
      </article>

      <article
        v-if="relatedArtists.length > 0"
        class="hx-card artist-detail-section-card"
        aria-label="Related artists"
      >
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Related artists</h2>
            <p class="hx-card-subtitle">
              Similar artists are surfaced alongside this profile so you can move through metadata context quickly.
            </p>
          </div>
        </header>

        <div class="hx-card-body artist-detail-section-card__body">
          <div class="artist-detail-related-strip" role="list">
            <ArtistDetailRelatedArtistCard
              v-for="related in relatedArtists"
              :key="related.id"
              :artist="related"
              :artwork-url="getRelatedArtwork(related.id)?.url ?? null"
              :meta-text="formatRelatedArtistScore(related.score)"
              :supporting-text="buildRelatedSupportingText(related)"
              :to="buildRelatedArtistLocation(related)"
              role="listitem"
            />
          </div>

          <p v-if="relatedError" class="artist-detail-soft-error" role="alert">
            {{ relatedError }}
          </p>
        </div>
      </article>
    </template>

    <ConfirmRequestModal
      :open="confirmModalOpen"
      :release="confirmRelease"
      :loading="confirmIsRequesting"
      :requested="confirmIsRequested"
      :error-message="confirmError"
      :users="isAdmin ? requestForUsers : []"
      @confirm="handleConfirmRequest"
      @close="closeConfirmModal"
    />

    <ReleaseDetailModal
      v-if="detailRelease"
      :open="detailModalOpen"
      :release-group-mbid="detailRelease?.releaseGroup?.id ?? detailRelease?.releaseGroupId ?? ''"
      :operator-draft="policyDraft"
      :operator-editing-disabled="isSavingPolicy || !policyDraft.monitoring.isMonitored"
      :operator-editing-enabled="canEditOperatorPolicy"
      :operator-release-group="detailRelease?.sourceReleaseGroup ?? null"
      :release-title="detailRelease?.title ?? null"
      :artist-name="artist?.name ?? null"
      :release-year="detailRelease?.date ? String(detailRelease.date).slice(0, 4) : null"
      @close="closeDetailModal"
      @requested="closeDetailModal"
      @track-override-change="updateDraftTrackOverride"
    />
  </section>
</template>

<style scoped>
.artist-detail-page {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.artist-detail-loading__title {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.artist-detail-loading__body {
  margin: var(--hx-space-2) 0 0;
  color: var(--hx-text-muted);
}

.artist-stage {
  overflow: hidden;
  background-position: center 24%;
  background-repeat: no-repeat;
  background-size: cover;
}

.artist-stage__body {
  display: grid;
  grid-template-columns: auto minmax(0, 1.4fr) minmax(240px, 0.95fr);
  gap: var(--hx-space-5);
  align-items: start;
}

.artist-stage__media {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.artist-stage__thumb {
  width: clamp(88px, 12vw, 112px);
  height: clamp(88px, 12vw, 112px);
  border-radius: var(--hx-radius-lg);
  object-fit: cover;
  box-shadow: var(--hx-shadow-md);
}

.artist-stage__thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--hx-bg-surface-muted) 76%, transparent);
  color: var(--hx-text-faint);
}

.artist-stage__thumb--placeholder svg {
  width: 46%;
  height: 46%;
}

.artist-stage__content {
  display: grid;
  gap: var(--hx-space-2);
  min-width: 0;
}

.artist-stage__eyebrow {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--hx-accent-strong);
}

.artist-stage__title {
  margin: 0;
}

.artist-stage__meta {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.artist-stage__copy {
  margin: 0;
  max-width: 60ch;
  color: var(--hx-text-muted);
  line-height: 1.6;
}

.artist-stage__signals,
.artist-stage__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.artist-stage__actions {
  margin-top: var(--hx-space-1);
}

.artist-stage__summary {
  display: grid;
  gap: var(--hx-space-3);
}

.artist-stage__summary-card {
  display: grid;
  gap: var(--hx-space-1);
  padding: var(--hx-space-3);
  border-radius: var(--hx-radius-lg);
  background: color-mix(in srgb, var(--hx-bg-surface) 84%, transparent);
  border: 1px solid var(--hx-border-subtle);
}

.artist-stage__summary-label {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.artist-stage__summary-value {
  font-size: var(--hx-text-lg);
  line-height: 1.05;
  color: var(--hx-text-strong);
}

.artist-stage__summary-body {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.5;
}

.artist-detail-soft-error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

.artist-policy-card__actions {
  align-items: center;
}

.artist-policy-card__body {
  display: grid;
  gap: var(--hx-space-4);
}

.artist-policy-card__monitor-toggle {
  display: flex;
  gap: var(--hx-space-3);
  align-items: flex-start;
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-muted);
}

.artist-policy-card__monitor-toggle input {
  margin-top: 3px;
}

.artist-policy-card__monitor-toggle span,
.artist-policy-card__grid label {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.artist-policy-card__monitor-toggle strong,
.artist-policy-card__grid span,
.artist-policy-card__fieldset legend {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.artist-policy-card__monitor-toggle small {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.4;
}

.artist-policy-card__fieldset {
  display: grid;
  gap: var(--hx-space-3);
  margin: 0;
  padding: 0;
  border: 0;
}

.artist-policy-card__checkbox-grid,
.artist-policy-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--hx-space-3);
}

.artist-policy-card__checkbox {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  min-height: 36px;
  padding: 0 var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface);
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.artist-policy-card__grid select {
  width: 100%;
}

.artist-detail-section-card__body {
  display: grid;
  gap: var(--hx-space-4);
}

.artist-detail-discography {
  display: grid;
  gap: var(--hx-space-5);
}

.artist-detail-discography__section {
  display: grid;
  gap: var(--hx-space-3);
}

.artist-detail-discography__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.artist-detail-discography__title {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.artist-detail-discography__meta {
  margin: 4px 0 0;
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
}

.artist-detail-grid {
  --hx-artwork-grid-min: 168px;
}

.artist-detail-selection {
  display: grid;
  gap: var(--hx-space-1);
  width: 100%;
}

.artist-detail-selection__select {
  width: 100%;
  min-width: 0;
  font-size: var(--hx-text-xs);
}

.artist-detail-selection__note {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.35;
}

.artist-detail-related-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--hx-space-3);
}

.is-spinning {
  animation: artist-detail-spin 0.8s linear infinite;
}

@keyframes artist-detail-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 960px) {
  .artist-stage__body {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .artist-stage__summary {
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .artist-stage__body,
  .artist-stage__summary,
  .artist-detail-related-strip {
    grid-template-columns: 1fr;
  }

  .artist-stage__media {
    justify-content: flex-start;
  }

  .artist-detail-grid {
    --hx-artwork-grid-min: 140px;
  }
}
</style>
