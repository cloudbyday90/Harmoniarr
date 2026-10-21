/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createManualSessionInput } from '../../testing/manual/manual-session-input.js';

function fixture(t) {
  const input = new PassThrough(); const output = new PassThrough(); const signals = new EventEmitter(); let text = '';
  output.setEncoding('utf8'); output.on('data', value => { text += value; });
  const session = createManualSessionInput({ input, output, signals });
  t.after(() => { session.dispose(); input.destroy(); output.destroy(); });
  return { input, output, signals, session, text: () => text };
}

test('quit during startup seals buffered command admission before a handler is installed', async t => {
  const ui = fixture(t); const calls = [];
  ui.input.write('status\nquit\nhold\n'); await ui.session.stopped;
  assert.equal(ui.session.signal.aborted, true); assert.equal(ui.session.signal.reason.code, 'manual_history_stopped');
  assert.equal(ui.session.acceptCommands(value => calls.push(value)), false); assert.deepEqual(calls, []);
  assert.equal(ui.text(), 'Session is starting. Use quit to cancel.\n');
});

test('EOF and signal events stop startup and preserve one cancellation reason', async t => {
  for (const kind of ['eof', 'SIGINT', 'SIGTERM']) {
    const ui = fixture(t);
    if (kind === 'eof') ui.input.end(); else ui.signals.emit(kind);
    await ui.session.stopped;
    const reason = ui.session.signal.reason; ui.signals.emit('SIGINT'); ui.signals.emit('SIGTERM');
    assert.equal(ui.session.signal.reason, reason); assert.equal(ui.session.signal.aborted, true);
  }
});

test('an already-ended input refuses startup without waiting for another close event', async t => {
  const input = new PassThrough(); const output = new PassThrough(); const signals = new EventEmitter();
  const ended = once(input, 'end'); input.resume(); input.end(); await ended;
  const session = createManualSessionInput({ input, output, signals });
  t.after(() => { session.dispose(); input.destroy(); output.destroy(); });
  await session.stopped; assert.equal(session.signal.aborted, true); assert.equal(session.acceptCommands(() => {}), false);
});

test('ready input forwards commands once, bounds command errors and refuses lines after quit', async t => {
  const ui = fixture(t); const calls = [];
  ui.session.acceptCommands(command => { calls.push(command); if (command === 'bad') throw null; return { command }; });
  ui.input.write(' status \nbad\nquit\nfail\n'); await ui.session.stopped;
  assert.deepEqual(calls, ['status', 'bad']); assert.equal(ui.text(), '{"command":"status"}\nManual command failed.\n');
});

test('disposal removes only owned signal listeners and leaves output usable', async t => {
  const input = new PassThrough(); const output = new PassThrough(); const signals = new EventEmitter();
  const other = () => {}; signals.on('SIGINT', other);
  const session = createManualSessionInput({ input, output, signals });
  t.after(() => { input.destroy(); output.destroy(); });
  assert.equal(signals.listenerCount('SIGINT'), 2); session.dispose(); session.dispose(); await session.stopped;
  assert.deepEqual(signals.listeners('SIGINT'), [other]); assert.equal(signals.listenerCount('SIGTERM'), 0);
  assert.equal(session.signal.aborted, false); assert.equal(session.acceptCommands(() => {}), false);
  assert.equal(output.destroyed, false);
});
