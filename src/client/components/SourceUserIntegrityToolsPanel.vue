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
import { reactive, ref } from 'vue';
import {
  fetchLibraryFidelityDashboard,
  fetchSourceUserCollusionReport,
  rescanLibrarySpectral,
  simulateSourceUserSpectralPolicy,
  simulateSourceUserTrustPolicy,
} from '../lib/activity-api.js';
import { updateSettings } from '../lib/settings-api.js';
import {
  buildCollusionViewModel,
  formatEstimatedBitrate,
  formatFingerprintPreview,
  formatRingSummary,
} from '../lib/source-user-collusion-presentation.js';
import {
  TRUST_THRESHOLD_FIELDS,
  buildStateComparisonRows,
  formatRatePercent,
  formatReviewStateTone,
  formatSimulationHeadline,
} from '../lib/source-user-trust-policy-presentation.js';
import {
  SPECTRAL_THRESHOLD_FIELDS,
  buildFidelityDashboardViewModel,
  buildSpectralThresholdSettingsPatch,
  buildVerdictComparisonRows,
  formatSpectralSimulationHeadline,
  formatVerdictTone,
} from '../lib/library-fidelity-presentation.js';

const DEFAULT_THRESHOLDS = {
  watchFailureCount: 3,
  watchMaxSuccessRate: 0.5,
  watchEvidenceCount: 3,
  healthyEvidenceCount: 5,
  healthyMinSuccessRate: 0.8,
};

const DEFAULT_SPECTRAL_THRESHOLDS = {
  authenticMinCutoffHz: 20000,
  suspiciousMinCutoffHz: 19000,
  transcodeMidCutoffHz: 16000,
  minTrustworthySampleRate: 44100,
};

// --- Retroactive spectral rescan ------------------------------------------
const rescanLimit = ref(250);
const isRescanning = ref(false);
const rescanResult = ref(null);
const rescanError = ref('');

async function runRescan() {
  isRescanning.value = true;
  rescanError.value = '';
  try {
    const limit = Number(rescanLimit.value);
    const response = await rescanLibrarySpectral({
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
    rescanResult.value = response;
  } catch (error) {
    rescanError.value = error?.message ?? 'Failed to start retroactive rescan.';
  } finally {
    isRescanning.value = false;
  }
}

// --- Collusion report ------------------------------------------------------
const collusion = ref(null);
const isLoadingCollusion = ref(false);
const collusionError = ref('');

async function loadCollusion() {
  isLoadingCollusion.value = true;
  collusionError.value = '';
  try {
    const report = await fetchSourceUserCollusionReport({});
    collusion.value = buildCollusionViewModel(report);
  } catch (error) {
    collusionError.value = error?.message ?? 'Failed to load collusion report.';
  } finally {
    isLoadingCollusion.value = false;
  }
}

// --- Trust policy simulator ------------------------------------------------
const thresholds = reactive({ ...DEFAULT_THRESHOLDS });
const simulation = ref(null);
const isSimulating = ref(false);
const simulationError = ref('');

function resetThresholds() {
  Object.assign(thresholds, DEFAULT_THRESHOLDS);
}

async function runSimulation() {
  isSimulating.value = true;
  simulationError.value = '';
  try {
    const response = await simulateSourceUserTrustPolicy({ thresholds: { ...thresholds } });
    simulation.value = response;
  } catch (error) {
    simulationError.value = error?.message ?? 'Failed to run policy simulation.';
  } finally {
    isSimulating.value = false;
  }
}

// --- Library fidelity health dashboard -------------------------------------
const fidelityDashboard = ref(null);
const isLoadingDashboard = ref(false);
const dashboardError = ref('');

async function loadFidelityDashboard() {
  isLoadingDashboard.value = true;
  dashboardError.value = '';
  try {
    const response = await fetchLibraryFidelityDashboard({});
    fidelityDashboard.value = buildFidelityDashboardViewModel(response);
  } catch (error) {
    dashboardError.value = error?.message ?? 'Failed to load fidelity dashboard.';
  } finally {
    isLoadingDashboard.value = false;
  }
}

// --- Spectral threshold simulator + apply ----------------------------------
const spectralThresholds = reactive({ ...DEFAULT_SPECTRAL_THRESHOLDS });
const spectralSimulation = ref(null);
const isSimulatingSpectral = ref(false);
const spectralSimulationError = ref('');
const isApplyingSpectral = ref(false);
const spectralApplyMessage = ref('');

function resetSpectralThresholds() {
  Object.assign(spectralThresholds, DEFAULT_SPECTRAL_THRESHOLDS);
}

async function runSpectralSimulation() {
  isSimulatingSpectral.value = true;
  spectralSimulationError.value = '';
  spectralApplyMessage.value = '';
  try {
    const response = await simulateSourceUserSpectralPolicy({ thresholds: { ...spectralThresholds } });
    spectralSimulation.value = response;
  } catch (error) {
    spectralSimulationError.value = error?.message ?? 'Failed to run spectral simulation.';
  } finally {
    isSimulatingSpectral.value = false;
  }
}

async function applySpectralThresholds() {
  isApplyingSpectral.value = true;
  spectralSimulationError.value = '';
  spectralApplyMessage.value = '';
  try {
    await updateSettings({ fidelity: buildSpectralThresholdSettingsPatch(spectralThresholds) });
    spectralApplyMessage.value = 'Spectral thresholds saved. New analysis will use the updated policy.';
  } catch (error) {
    spectralSimulationError.value = error?.message ?? 'Failed to save spectral thresholds.';
  } finally {
    isApplyingSpectral.value = false;
  }
}
</script>

<template>
  <section class="integrity-tools">
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Retroactive spectral rescan</h3>
          <p class="hx-card-subtitle">
            Re-grade historical lossless files through the same spectral queue. A content-addressed
            cache skips redundant decodes, so already-measured files return instantly.
          </p>
        </div>
      </header>
      <div class="hx-card-body">
        <div class="hx-form-row">
          <div class="hx-field" style="max-width: 12rem">
            <label class="hx-field-label" for="rescan-limit">Batch size</label>
            <input
              id="rescan-limit"
              v-model.number="rescanLimit"
              class="hx-input"
              type="number"
              min="1"
              max="2000"
            />
          </div>
          <button type="button" class="hx-btn" data-variant="primary" :disabled="isRescanning" @click="runRescan">
            {{ isRescanning ? 'Scanning…' : 'Start rescan' }}
          </button>
        </div>
        <p v-if="rescanError" class="hx-alert" data-tone="danger">{{ rescanError }}</p>
        <dl v-else-if="rescanResult" class="integrity-metrics">
          <div><dt>Candidates</dt><dd>{{ rescanResult.scan?.candidates ?? 0 }}</dd></div>
          <div><dt>Enqueued</dt><dd>{{ rescanResult.scan?.enqueued ?? 0 }}</dd></div>
          <div><dt>Skipped</dt><dd>{{ rescanResult.scan?.skipped ?? 0 }}</dd></div>
          <div><dt>Processed</dt><dd>{{ rescanResult.processed?.processed ?? 0 }}</dd></div>
          <div><dt>Cache hits</dt><dd>{{ rescanResult.processed?.cacheHits ?? 0 }}</dd></div>
        </dl>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Cross-peer collusion</h3>
          <p class="hx-card-subtitle">
            Peers sharing identical confirmed-transcode fingerprints are grouped into rings —
            a strong signal of a single upstream fake source re-shared under many names.
          </p>
        </div>
        <button type="button" class="hx-btn" :disabled="isLoadingCollusion" @click="loadCollusion">
          {{ isLoadingCollusion ? 'Loading…' : 'Run detection' }}
        </button>
      </header>
      <div class="hx-card-body">
        <p v-if="collusionError" class="hx-alert" data-tone="danger">{{ collusionError }}</p>
        <template v-else-if="collusion">
          <p class="hx-card-subtitle">{{ collusion.headline }}</p>
          <ul v-if="collusion.rings.length > 0" class="ring-list">
            <li v-for="ring in collusion.rings" :key="ring.ringId" class="ring-item">
              <header class="ring-item-head">
                <strong>{{ ring.ringId }}</strong>
                <span class="hx-badge" data-tone="warning">{{ formatRingSummary(ring) }}</span>
              </header>
              <p class="ring-members">
                <span v-for="member in ring.members" :key="member.usernameKey" class="hx-tag">
                  {{ member.username }}
                </span>
              </p>
              <ul class="ring-fingerprints">
                <li v-for="fingerprint in ring.fingerprints" :key="fingerprint.contentHash">
                  <code>{{ formatFingerprintPreview(fingerprint.contentHash) }}</code>
                  <span>{{ formatEstimatedBitrate(fingerprint.estimatedSourceBitrate) }}</span>
                </li>
              </ul>
            </li>
          </ul>
        </template>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Trust threshold policy simulator</h3>
          <p class="hx-card-subtitle">
            Preview how proposed review thresholds would reclassify the current peer population.
            This is read-only — nothing is saved until you change the live policy.
          </p>
        </div>
      </header>
      <div class="hx-card-body">
        <div class="threshold-grid">
          <div v-for="field in TRUST_THRESHOLD_FIELDS" :key="field.key" class="hx-field">
            <label class="hx-field-label" :for="`threshold-${field.key}`">{{ field.label }}</label>
            <input
              :id="`threshold-${field.key}`"
              v-model.number="thresholds[field.key]"
              class="hx-input"
              type="number"
              :min="field.min"
              :max="field.max"
              :step="field.kind === 'rate' ? 0.05 : 1"
            />
          </div>
        </div>
        <div class="hx-form-row" style="margin-top: var(--hx-space-3)">
          <button type="button" class="hx-btn" data-variant="primary" :disabled="isSimulating" @click="runSimulation">
            {{ isSimulating ? 'Simulating…' : 'Simulate' }}
          </button>
          <button type="button" class="hx-btn" data-variant="ghost" @click="resetThresholds">
            Reset to defaults
          </button>
        </div>

        <p v-if="simulationError" class="hx-alert" data-tone="danger">{{ simulationError }}</p>
        <template v-else-if="simulation">
          <p class="hx-card-subtitle">{{ formatSimulationHeadline(simulation) }}</p>
          <table class="hx-table">
            <thead>
              <tr><th>Review state</th><th>Current</th><th>Projected</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in buildStateComparisonRows(simulation.summary)" :key="row.state">
                <td><span class="hx-badge" :data-tone="formatReviewStateTone(row.state)">{{ row.state }}</span></td>
                <td>{{ row.current }}</td>
                <td>{{ row.projected }}</td>
              </tr>
            </tbody>
          </table>
          <ul v-if="simulation.transitions?.length" class="transition-list">
            <li v-for="transition in simulation.transitions" :key="`${transition.from}->${transition.to}`">
              <span class="hx-badge" :data-tone="formatReviewStateTone(transition.from)">{{ transition.from }}</span>
              →
              <span class="hx-badge" :data-tone="formatReviewStateTone(transition.to)">{{ transition.to }}</span>
              <span>×{{ transition.count }}</span>
            </li>
          </ul>
          <p class="hx-card-subtitle" style="margin-top: var(--hx-space-2)">
            Success rates evaluated at thresholds —
            watch ≤ {{ formatRatePercent(simulation.thresholds?.watchMaxSuccessRate) }},
            healthy ≥ {{ formatRatePercent(simulation.thresholds?.healthyMinSuccessRate) }}.
          </p>
        </template>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Library fidelity health</h3>
          <p class="hx-card-subtitle">
            Catalog-level quality KPI aggregated from every completed spectral measurement:
            a health score, verdict distribution, by-codec breakdown, worst offenders, and trend.
          </p>
        </div>
        <button type="button" class="hx-btn" :disabled="isLoadingDashboard" @click="loadFidelityDashboard">
          {{ isLoadingDashboard ? 'Loading…' : 'Load dashboard' }}
        </button>
      </header>
      <div class="hx-card-body">
        <p v-if="dashboardError" class="hx-alert" data-tone="danger">{{ dashboardError }}</p>
        <template v-else-if="fidelityDashboard">
          <dl class="integrity-metrics">
            <div>
              <dt>Health score</dt>
              <dd>
                <span class="hx-badge" :data-tone="fidelityDashboard.healthScore.tone">
                  {{ fidelityDashboard.healthScore.label }}
                </span>
              </dd>
            </div>
            <div><dt>Measurements</dt><dd>{{ fidelityDashboard.totalMeasurements }}</dd></div>
            <div><dt>Conclusive</dt><dd>{{ fidelityDashboard.conclusiveMeasurements }}</dd></div>
            <div>
              <dt>Transcode rate</dt>
              <dd>{{ fidelityDashboard.transcodeRatePercent === null ? '—' : `${fidelityDashboard.transcodeRatePercent}%` }}</dd>
            </div>
          </dl>

          <table class="hx-table" style="margin-top: var(--hx-space-3)">
            <thead><tr><th>Verdict</th><th>Count</th></tr></thead>
            <tbody>
              <tr v-for="row in fidelityDashboard.verdictRows" :key="row.verdict">
                <td><span class="hx-badge" :data-tone="formatVerdictTone(row.verdict)">{{ row.verdict }}</span></td>
                <td>{{ row.count }}</td>
              </tr>
            </tbody>
          </table>

          <template v-if="fidelityDashboard.codecBreakdown.length">
            <h4 class="hx-card-title" style="font-size: var(--hx-text-sm); margin-top: var(--hx-space-3)">By codec</h4>
            <table class="hx-table">
              <thead><tr><th>Codec</th><th>Total</th><th>Transcoded</th><th>Suspicious</th></tr></thead>
              <tbody>
                <tr v-for="row in fidelityDashboard.codecBreakdown" :key="row.codec">
                  <td><code>{{ row.codec }}</code></td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.transcoded }}</td>
                  <td>{{ row.suspicious }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <template v-if="fidelityDashboard.worstOffenders.length">
            <h4 class="hx-card-title" style="font-size: var(--hx-text-sm); margin-top: var(--hx-space-3)">Worst offenders</h4>
            <table class="hx-table">
              <thead><tr><th>Source</th><th>Transcoded</th><th>Total</th><th>Rate</th></tr></thead>
              <tbody>
                <tr v-for="row in fidelityDashboard.worstOffenders" :key="row.username">
                  <td>{{ row.username }}</td>
                  <td>{{ row.transcoded }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ Math.round((row.transcodeRate ?? 0) * 100) }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Spectral threshold policy simulator</h3>
          <p class="hx-card-subtitle">
            Preview how proposed cutoff-band thresholds would re-grade the measured population.
            Simulation is read-only; “Apply” persists the thresholds for all future analysis.
          </p>
        </div>
      </header>
      <div class="hx-card-body">
        <div class="threshold-grid">
          <div v-for="field in SPECTRAL_THRESHOLD_FIELDS" :key="field.key" class="hx-field">
            <label class="hx-field-label" :for="`spectral-${field.key}`">{{ field.label }}</label>
            <input
              :id="`spectral-${field.key}`"
              v-model.number="spectralThresholds[field.key]"
              class="hx-input"
              type="number"
              :min="field.min"
              :max="field.max"
              step="100"
            />
          </div>
        </div>
        <div class="hx-form-row" style="margin-top: var(--hx-space-3)">
          <button type="button" class="hx-btn" data-variant="primary" :disabled="isSimulatingSpectral" @click="runSpectralSimulation">
            {{ isSimulatingSpectral ? 'Simulating…' : 'Simulate' }}
          </button>
          <button type="button" class="hx-btn" :disabled="isApplyingSpectral" @click="applySpectralThresholds">
            {{ isApplyingSpectral ? 'Saving…' : 'Apply thresholds' }}
          </button>
          <button type="button" class="hx-btn" data-variant="ghost" @click="resetSpectralThresholds">
            Reset to defaults
          </button>
        </div>

        <p v-if="spectralApplyMessage" class="hx-alert" data-tone="success">{{ spectralApplyMessage }}</p>
        <p v-if="spectralSimulationError" class="hx-alert" data-tone="danger">{{ spectralSimulationError }}</p>
        <template v-if="spectralSimulation">
          <p class="hx-card-subtitle">{{ formatSpectralSimulationHeadline(spectralSimulation) }}</p>
          <table class="hx-table">
            <thead><tr><th>Verdict</th><th>Current</th><th>Projected</th></tr></thead>
            <tbody>
              <tr v-for="row in buildVerdictComparisonRows(spectralSimulation.summary)" :key="row.verdict">
                <td><span class="hx-badge" :data-tone="formatVerdictTone(row.verdict)">{{ row.verdict }}</span></td>
                <td>{{ row.current }}</td>
                <td>{{ row.projected }}</td>
              </tr>
            </tbody>
          </table>
          <ul v-if="spectralSimulation.transitions?.length" class="transition-list">
            <li v-for="transition in spectralSimulation.transitions" :key="`${transition.from}->${transition.to}`">
              <span class="hx-badge" :data-tone="formatVerdictTone(transition.from)">{{ transition.from }}</span>
              →
              <span class="hx-badge" :data-tone="formatVerdictTone(transition.to)">{{ transition.to }}</span>
              <span>×{{ transition.count }}</span>
            </li>
          </ul>
        </template>
      </div>
    </article>
  </section>
</template>

<style scoped>
.integrity-tools {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
}

.integrity-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-4);
  margin: 0;
}

.integrity-metrics dt {
  font-size: var(--hx-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hx-text-muted);
}

.integrity-metrics dd {
  margin: 0;
  font-size: var(--hx-text-lg);
  font-weight: 600;
}

.ring-list,
.ring-fingerprints,
.transition-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ring-list {
  display: grid;
  gap: var(--hx-space-3);
}

.ring-item {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  padding: var(--hx-space-3);
}

.ring-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-2);
}

.ring-members {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-1);
  margin: var(--hx-space-2) 0;
}

.ring-fingerprints li {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
  font-size: var(--hx-text-sm);
}

.threshold-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--hx-space-3);
}

.transition-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-2);
}

.transition-list li {
  display: flex;
  align-items: center;
  gap: var(--hx-space-1);
}
</style>
