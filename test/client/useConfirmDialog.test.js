import assert from 'node:assert/strict';
import test from 'node:test';
import { useConfirmDialog, CONFIRM_LEVEL } from '../../src/client/composables/useConfirmDialog.js';

test('useConfirmDialog starts with stage closed and isOpen false', () => {
  const { stage, isOpen } = useConfirmDialog();
  assert.equal(stage.value, 'closed');
  assert.equal(isOpen.value, false);
});

test('useConfirmDialog open transitions stage to confirming', () => {
  const { stage, isOpen, isConfirming, open } = useConfirmDialog();
  open();
  assert.equal(stage.value, 'confirming');
  assert.equal(isOpen.value, true);
  assert.equal(isConfirming.value, true);
});

test('useConfirmDialog close resets all state', () => {
  const {
    stage,
    typed,
    acknowledged,
    buttonEnabled,
    close,
    open,
    isOpen,
  } = useConfirmDialog();

  open();
  typed.value = 'test';
  acknowledged.value = true;

  close();

  assert.equal(stage.value, 'closed');
  assert.equal(isOpen.value, false);
  assert.equal(typed.value, '');
  assert.equal(acknowledged.value, false);
  assert.equal(buttonEnabled.value, false);
});

test('useConfirmDialog checkbox level: button enabled only when acknowledged', () => {
  const {
    acknowledged,
    buttonEnabled,
    canConfirm,
    open,
  } = useConfirmDialog({ confirmLevel: CONFIRM_LEVEL.CHECKBOX });

  open();
  assert.equal(canConfirm.value, false);
  assert.equal(buttonEnabled.value, false);

  acknowledged.value = true;
  assert.equal(canConfirm.value, true);
  assert.equal(buttonEnabled.value, true);
});

test('useConfirmDialog type_to_confirm level: button enabled when acknowledged AND text matches', () => {
  const CONFIRM_TEXT = 'delete project';
  const {
    typed,
    acknowledged,
    buttonEnabled,
    canConfirm,
    matches,
    open,
  } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.TYPE_TO_CONFIRM,
    confirmText: CONFIRM_TEXT,
  });

  open();
  assert.equal(canConfirm.value, false);
  assert.equal(buttonEnabled.value, false);
  assert.equal(matches.value, false);

  acknowledged.value = true;
  assert.equal(canConfirm.value, false);

  typed.value = CONFIRM_TEXT;
  assert.equal(matches.value, true);
  assert.equal(canConfirm.value, true);
  assert.equal(buttonEnabled.value, true);
});

test('useConfirmDialog type_to_confirm: typed text must match exactly', () => {
  const CONFIRM_TEXT = 'start import apply';
  const { typed, acknowledged, matches, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.TYPE_TO_CONFIRM,
    confirmText: CONFIRM_TEXT,
  });

  open();
  acknowledged.value = true;

  typed.value = 'start import';
  assert.equal(matches.value, false);

  typed.value = 'start import apply ';
  assert.equal(matches.value, false);

  typed.value = 'Start import apply';
  assert.equal(matches.value, false);

  typed.value = CONFIRM_TEXT;
  assert.equal(matches.value, true);
});

test('useConfirmDialog none level: always ready to confirm', () => {
  const { canConfirm, buttonEnabled, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.NONE,
  });

  open();
  assert.equal(canConfirm.value, true);
  assert.equal(buttonEnabled.value, true);
});

test('useConfirmDialog handleExecute calls execute function and transitions to done', async () => {
  let called = false;
  const execute = async () => {
    called = true;
    return { success: true };
  };

  const { handleExecute, stage, result, acknowledged, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.CHECKBOX,
    execute,
  });

  open();
  acknowledged.value = true;

  await handleExecute();

  assert.equal(called, true);
  assert.equal(stage.value, 'done');
  assert.deepEqual(result.value, { success: true });
});

test('useConfirmDialog handleExecute sets error and returns to confirming on failure', async () => {
  const execute = async () => {
    throw new Error('Operation failed');
  };

  const { handleExecute, stage, error, acknowledged, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.CHECKBOX,
    execute,
    errorLabel: 'Default error',
  });

  open();
  acknowledged.value = true;

  await handleExecute();

  assert.equal(stage.value, 'confirming');
  assert.ok(error.value.includes('Operation failed'));
});

test('useConfirmDialog handleExecute no-ops when canConfirm is false', async () => {
  let called = false;
  const execute = async () => { called = true; };

  const { handleExecute, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.CHECKBOX,
    execute,
  });

  open();

  await handleExecute();

  assert.equal(called, false);
});

test('useConfirmDialog isExecuting transitions during execution', async () => {
  let resolveExecute;
  const execute = () => new Promise((resolve) => { resolveExecute = resolve; });

  const { handleExecute, isExecuting, isConfirming, acknowledged, open } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.CHECKBOX,
    execute,
  });

  open();
  acknowledged.value = true;

  const execPromise = handleExecute();

  assert.equal(isExecuting.value, true);
  assert.equal(isConfirming.value, false);

  resolveExecute();
  await execPromise;

  assert.equal(isExecuting.value, false);
});

test('useConfirmDialog open resets result and error from previous execution', async () => {
  const execute = async () => ({ success: true });

  const { handleExecute, acknowledged, open, result, error } = useConfirmDialog({
    confirmLevel: CONFIRM_LEVEL.CHECKBOX,
    execute,
  });

  open();
  acknowledged.value = true;
  await handleExecute();

  assert.equal(result.value?.success, true);

  open();
  assert.equal(result.value, null);
  assert.equal(error.value, '');
});
