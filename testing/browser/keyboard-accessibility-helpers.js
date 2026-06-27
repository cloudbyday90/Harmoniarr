/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';

export async function assertLocatorFocused(locator, message = 'expected locator to be focused') {
  await locator.waitFor({ state: 'visible' });
  const isFocused = await locator.evaluate((element) => element === element.ownerDocument.activeElement);
  assert.equal(isFocused, true, message);
}

export async function assertVisibleFocusOutline(locator, message = 'expected visible focus outline') {
  await locator.waitFor({ state: 'visible' });
  const outline = await locator.evaluate((element) => {
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return {
      color: style.outlineColor,
      offset: style.outlineOffset,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });

  assert.notEqual(outline.style, 'none', message);
  assert.ok(Number.parseFloat(outline.width) >= 2, `${message}: outline width was ${outline.width}`);
  assert.notEqual(outline.color, 'rgba(0, 0, 0, 0)', `${message}: outline color was transparent`);
}

export async function assertFocusWithin(containerLocator, message = 'expected focus to stay within container') {
  await containerLocator.waitFor({ state: 'visible' });
  const containsFocus = await containerLocator.evaluate((container) =>
    container.contains(container.ownerDocument.activeElement),
  );
  assert.equal(containsFocus, true, message);
}

export async function assertTabFocusContained(page, containerLocator, {
  steps = 1,
  backwards = false,
  message = 'Tab focus should stay inside the active container',
} = {}) {
  const key = backwards ? 'Shift+Tab' : 'Tab';
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press(key);
    await assertFocusWithin(containerLocator, `${message} after ${key} step ${index + 1}`);
  }
}

export async function waitForRovingTabindexes(page, containerLocator, {
  cellSelector,
  expected,
}) {
  const containerHandle = await containerLocator.elementHandle();
  assert.ok(containerHandle, 'expected roving container to exist');

  try {
    await page.waitForFunction(([container, selector, expectedValues]) => {
      const cells = Array.from(container.querySelectorAll(selector));
      if (cells.length < expectedValues.length) {
        return false;
      }
      return expectedValues.every((value, index) => cells[index].getAttribute('tabindex') === value);
    }, [containerHandle, cellSelector, expected]);
  } finally {
    await containerHandle.dispose();
  }
}

export async function getRovingActiveIndex(containerLocator, cellSelector) {
  return containerLocator.evaluate((container, selector) => {
    const cells = Array.from(container.querySelectorAll(selector));
    return cells.findIndex((cell) => cell.getAttribute('tabindex') === '0');
  }, cellSelector);
}

export async function getItemControlTabindexes(containerLocator, {
  cellSelector,
  controlSelector,
}) {
  return containerLocator.evaluate((container, { cells, controls }) =>
    Array.from(container.querySelectorAll(cells)).map((cell) => {
      const item = cell.closest('li') ?? cell.parentElement;
      return Array.from(item?.querySelectorAll(controls) ?? [])
        .filter((control) => control !== cell)
        .map((control) => control.getAttribute('tabindex'));
    }), {
    cells: cellSelector,
    controls: controlSelector,
  });
}

export async function assertRovingGridMovement({
  cellSelector = '.hx-media-card__link-area',
  expectedCount,
  list,
  nextKey = 'ArrowRight',
  page,
}) {
  const cells = list.locator(cellSelector);
  await cells.nth(expectedCount - 1).waitFor();
  assert.equal(await cells.count(), expectedCount);

  await waitForRovingTabindexes(page, list, {
    cellSelector,
    expected: ['0', ...Array.from({ length: expectedCount - 1 }, () => '-1')],
  });

  await cells.nth(0).focus();
  await cells.nth(0).press(nextKey);
  await assertLocatorFocused(cells.nth(1), `${nextKey} should focus the next grid card`);
  await assertVisibleFocusOutline(cells.nth(1), 'grid card focus ring should be visible');

  await cells.nth(1).press('Control+End');
  await assertLocatorFocused(cells.nth(expectedCount - 1), 'Control+End should focus the last grid card');

  await cells.nth(expectedCount - 1).press('Control+Home');
  await assertLocatorFocused(cells.nth(0), 'Control+Home should focus the first grid card');

  return { cells };
}
