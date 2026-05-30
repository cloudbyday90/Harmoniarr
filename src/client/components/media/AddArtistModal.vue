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
import { computed, nextTick, reactive, ref, watch } from 'vue';
import {
  addArtistAcquisitionProfileOptions,
  addArtistContentTypeOptions,
  addArtistReleaseScopeOptions,
  addArtistWantedAutomationOptions,
  defaultAddArtistPolicyForm,
  normalizeAddArtistPolicyForm,
} from '../../lib/add-artist-policy.js';
import {
  buildDiscoverArtistInitial,
  buildDiscoverAvatarStyle,
} from '../../lib/discover-presentation.js';

const props = defineProps({
  artist: {
    type: Object,
    default: null,
  },
  artwork: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  initialPolicy: {
    type: Object,
    default: () => defaultAddArtistPolicyForm,
  },
  open: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'submit']);

const panelRef = ref(null);
const titleRef = ref(null);
let previouslyFocusedElement = null;

const form = reactive({
  acquisitionProfileKey: defaultAddArtistPolicyForm.acquisitionProfileKey,
  monitoredReleaseGroupTypes: [...defaultAddArtistPolicyForm.monitoredReleaseGroupTypes],
  releaseScope: defaultAddArtistPolicyForm.releaseScope,
  searchNow: defaultAddArtistPolicyForm.searchNow,
  useAsDefault: defaultAddArtistPolicyForm.useAsDefault,
  wantedAutomationMode: defaultAddArtistPolicyForm.wantedAutomationMode,
});

const titleId = computed(() => `add-artist-title-${props.artist?.id ?? 'candidate'}`);
const introId = computed(() => `add-artist-intro-${props.artist?.id ?? 'candidate'}`);
const formValid = computed(() => form.monitoredReleaseGroupTypes.length > 0);

function resetForm() {
  const normalized = normalizeAddArtistPolicyForm(props.initialPolicy);
  form.acquisitionProfileKey = normalized.acquisitionProfileKey;
  form.monitoredReleaseGroupTypes = [...normalized.monitoredReleaseGroupTypes];
  form.releaseScope = normalized.releaseScope;
  form.searchNow = normalized.searchNow;
  form.useAsDefault = normalized.useAsDefault;
  form.wantedAutomationMode = normalized.wantedAutomationMode;
}

function close() {
  if (!props.saving) {
    emit('close');
  }
}

function handleSubmit() {
  if (!formValid.value || props.saving) {
    return;
  }

  emit('submit', normalizeAddArtistPolicyForm(form));
}

function getFocusableElements() {
  if (!panelRef.value) return [];
  return [...panelRef.value.querySelectorAll([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))].filter((element) => !element.hasAttribute('hidden'));
}

function handleDialogKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableElements();
  if (focusableElements.length === 0) {
    event.preventDefault();
    titleRef.value?.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    resetForm();
    await nextTick();
    titleRef.value?.focus();
  } else if (previouslyFocusedElement) {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
  }
});

watch(() => props.initialPolicy, () => {
  if (props.open) {
    resetForm();
  }
}, { deep: true });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && artist"
      class="add-artist-modal"
      @click.self="close"
    >
      <section
        ref="panelRef"
        class="add-artist-modal__panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="introId"
        @keydown="handleDialogKeydown"
      >
        <header class="add-artist-modal__header">
          <div class="add-artist-modal__identity">
            <img
              v-if="artwork?.url"
              :src="artwork.url"
              :alt="artist.name"
              class="add-artist-modal__artwork"
            />
            <div
              v-else
              class="add-artist-modal__artwork add-artist-modal__artwork--placeholder"
              :style="buildDiscoverAvatarStyle(artist.id, artist.name)"
              aria-hidden="true"
            >
              <span>{{ buildDiscoverArtistInitial(artist.id, artist.name) }}</span>
            </div>
            <div>
              <p class="add-artist-modal__eyebrow">Add artist</p>
              <h2 :id="titleId" ref="titleRef" class="add-artist-modal__title" tabindex="-1">
                {{ artist.name }}
              </h2>
              <p :id="introId" class="add-artist-modal__intro">
                Add this artist to your monitored profile and choose how Harmoniarr should track releases.
              </p>
            </div>
          </div>
          <button
            type="button"
            class="hx-btn hx-btn-icon"
            data-variant="ghost"
            :disabled="saving"
            aria-label="Close add artist"
            @click="close"
          >
            x
          </button>
        </header>

        <form class="add-artist-modal__form" @submit.prevent="handleSubmit">
          <fieldset class="add-artist-modal__fieldset">
            <legend>Content to track</legend>
            <p>Choose which release types participate in monitoring and acquisition workflows.</p>
            <div class="add-artist-modal__checkbox-grid">
              <label
                v-for="option in addArtistContentTypeOptions"
                :key="option.value"
                class="add-artist-modal__check"
              >
                <input
                  v-model="form.monitoredReleaseGroupTypes"
                  type="checkbox"
                  :value="option.value"
                  :disabled="saving"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </fieldset>

          <div class="add-artist-modal__grid">
            <label class="hx-field">
              <span class="hx-field-label">Release scope</span>
              <select v-model="form.releaseScope" class="hx-select" :disabled="saving">
                <option
                  v-for="option in addArtistReleaseScopeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <span class="add-artist-modal__help">
                {{ addArtistReleaseScopeOptions.find((option) => option.value === form.releaseScope)?.description }}
              </span>
            </label>

            <label class="hx-field">
              <span class="hx-field-label">Acquisition profile</span>
              <select v-model="form.acquisitionProfileKey" class="hx-select" :disabled="saving">
                <option
                  v-for="option in addArtistAcquisitionProfileOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <span class="add-artist-modal__help">
                {{ addArtistAcquisitionProfileOptions.find((option) => option.value === form.acquisitionProfileKey)?.description }}
              </span>
            </label>

            <label class="hx-field">
              <span class="hx-field-label">Wanted automation</span>
              <select v-model="form.wantedAutomationMode" class="hx-select" :disabled="saving">
                <option
                  v-for="option in addArtistWantedAutomationOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <span class="add-artist-modal__help">
                {{ addArtistWantedAutomationOptions.find((option) => option.value === form.wantedAutomationMode)?.description }}
              </span>
            </label>
          </div>

          <div class="add-artist-modal__toggles">
            <label class="add-artist-modal__check add-artist-modal__check--wide">
              <input v-model="form.searchNow" type="checkbox" :disabled="saving" />
              <span>Search for eligible missing items now</span>
            </label>
            <label class="add-artist-modal__check add-artist-modal__check--wide">
              <input v-model="form.useAsDefault" type="checkbox" :disabled="saving" />
              <span>Use these settings next time</span>
            </label>
          </div>

          <p v-if="!formValid" class="add-artist-modal__error" role="alert">
            Select at least one content type.
          </p>
          <p v-else-if="errorMessage" class="add-artist-modal__error" role="alert">
            {{ errorMessage }}
          </p>

          <footer class="add-artist-modal__actions">
            <button type="button" class="hx-btn" data-variant="ghost" :disabled="saving" @click="close">
              Cancel
            </button>
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="saving || !formValid"
              :aria-busy="saving || undefined"
            >
              {{ saving ? 'Adding...' : 'Add artist' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.add-artist-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: var(--hx-space-4);
  background: var(--hx-bg-overlay);
}

.add-artist-modal__panel {
  width: min(720px, 100%);
  max-height: min(760px, calc(100vh - (var(--hx-space-4) * 2)));
  overflow: auto;
  border: 1px solid var(--hx-border-strong);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-lg);
}

.add-artist-modal__header {
  display: flex;
  gap: var(--hx-space-3);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.add-artist-modal__identity {
  display: flex;
  gap: var(--hx-space-3);
  min-width: 0;
}

.add-artist-modal__artwork {
  width: 72px;
  height: 72px;
  flex: 0 0 auto;
  border-radius: var(--hx-radius-sm);
  object-fit: cover;
  background: var(--hx-bg-surface-sunken);
}

.add-artist-modal__artwork--placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--hx-text-xl);
  font-weight: 800;
}

.add-artist-modal__eyebrow {
  margin: 0 0 var(--hx-space-1);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hx-accent-strong);
}

.add-artist-modal__title {
  margin: 0;
  font-size: var(--hx-text-xl);
  line-height: 1.15;
  color: var(--hx-text-strong);
  outline: none;
}

.add-artist-modal__intro {
  margin: var(--hx-space-1) 0 0;
  max-width: 56ch;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.add-artist-modal__form {
  display: grid;
  gap: var(--hx-space-4);
  padding: var(--hx-space-4);
}

.add-artist-modal__fieldset {
  display: grid;
  gap: var(--hx-space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.add-artist-modal__fieldset legend {
  padding: 0;
  font-size: var(--hx-text-sm);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.add-artist-modal__fieldset p,
.add-artist-modal__help {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.45;
}

.add-artist-modal__checkbox-grid,
.add-artist-modal__toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.add-artist-modal__check {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-2);
  min-height: 40px;
  padding: var(--hx-space-2) var(--hx-space-3);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-muted);
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.add-artist-modal__check--wide {
  min-width: min(100%, 260px);
}

.add-artist-modal__check input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--hx-accent-strong);
}

.add-artist-modal__grid {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.add-artist-modal__error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.add-artist-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--hx-space-2);
  padding-top: var(--hx-space-3);
  border-top: 1px solid var(--hx-border-subtle);
}

@media (max-width: 760px) {
  .add-artist-modal__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .add-artist-modal {
    align-items: end;
    padding: var(--hx-space-2);
  }

  .add-artist-modal__panel {
    max-height: calc(100vh - (var(--hx-space-2) * 2));
  }

  .add-artist-modal__header,
  .add-artist-modal__form {
    padding: var(--hx-space-3);
  }

  .add-artist-modal__artwork {
    width: 56px;
    height: 56px;
  }

  .add-artist-modal__actions {
    flex-direction: column-reverse;
  }
}
</style>
