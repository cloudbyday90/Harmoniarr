/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { readCheckoutProperty as read } from './pool-checkout-record.js';

const phases = new Set(['seed_total', 'consent', 'tooling', 'media_generate', 'media_inspect',
  'candidate_prepare', 'delivery_preview', 'delivery_apply', 'receipt_history', 'receipt_validate']);
const ordinal = value => Number.isSafeInteger(value) && value > 0 && value <= 1_000_000;

export function captureWantedSeedRecord(input) {
  const phase = read(input, 'phase'); const event = read(input, 'event');
  const spanId = read(input, 'spanId'); const parentSpanId = read(input, 'parentSpanId');
  const context = read(input, 'context'); const durationMs = read(input, 'durationMs');
  const outcome = read(input, 'outcome');
  if (!phases.has(phase) || !['start', 'settled'].includes(event) || !ordinal(spanId)) return null;
  return Object.freeze({ version: 1, phase, event, spanId,
    parentSpanId: ordinal(parentSpanId) ? parentSpanId : null,
    context: [1, 2, 3, 4].includes(context) ? context : null,
    outcome: event === 'settled' && ['completed', 'failed'].includes(outcome) ? outcome : null,
    durationMs: event === 'settled' && Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= 86_400_000 ? durationMs : null });
}

export const disabledWantedSeedObserver = Object.freeze({ measure: async (_phase, _context, operation) => operation() });

/** Records describe returned work. Optional sink/clock failures cannot replace it. */
export function createWantedSeedObserver({ onRecord = null, now = () => performance.now() } = {}) {
  if ((onRecord !== null && typeof onRecord !== 'function') || typeof now !== 'function') throw new TypeError('Invalid seed observer');
  const contextStore = new AsyncLocalStorage(); let sequence = 0;
  const clock = () => { try { const value = now(); return Number.isFinite(value) ? value : null; } catch { return null; } };
  const publish = async record => { try { await onRecord(captureWantedSeedRecord(record)); } catch { /* Optional observation. */ } };
  async function measure(phase, context, operation) {
    if (!phases.has(phase) || (context !== null && ![1, 2, 3, 4].includes(context)) || typeof operation !== 'function') throw new TypeError('Invalid seed phase');
    if (!onRecord) return operation();
    const spanId = ++sequence; const parentSpanId = contextStore.getStore()?.spanId ?? null;
    await publish({ phase, context, spanId, parentSpanId, event: 'start' });
    const started = clock(); let outcome = 'completed';
    try { return await contextStore.run({ spanId, context }, operation); }
    catch (error) { outcome = 'failed'; throw error; }
    finally {
      const ended = clock();
      await publish({ phase, context, spanId, parentSpanId, event: 'settled', outcome,
        durationMs: started !== null && ended !== null && ended >= started ? ended - started : null });
    }
  }
  return Object.freeze({ measure, currentContext: () => contextStore.getStore()?.context });
}
