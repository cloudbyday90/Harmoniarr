/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

export async function inspectSettingsForm(page) {
  return page.locator('.cfg-page form').evaluate(form => {
    const main = form.closest('.hx-main'), bar = form.querySelector('.settings-save-bar'), rect = bar.getBoundingClientRect();
    return { width: globalThis.innerWidth, height: globalThis.innerHeight, position: globalThis.getComputedStyle(bar).position,
      barHeight: rect.height, mainHeight: main.clientHeight, reservation: Number.parseFloat(main.style.getPropertyValue('--hx-settings-save-bar-height')) || 0,
      scrollPaddingBottom: Number.parseFloat(globalThis.getComputedStyle(main).scrollPaddingBottom), noHorizontalOverflow: main.scrollWidth <= main.clientWidth + 1,
      barWithinForm: rect.left >= form.getBoundingClientRect().left - 1 && rect.right <= form.getBoundingClientRect().right + 1,
      overflowFlow: bar.hasAttribute('data-sticky-overflow') };
  });
}

export async function traverseSettingsForm(page, { backwards = false } = {}) {
  const formLocator = page.locator('.cfg-page form');
  const controls = formLocator.locator('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]');
  if (backwards) await controls.last().focus(); else await controls.first().focus();
  let checked = 0;
  for (let index = 0; index < 180; index++) {
    const target = await page.evaluate(() => {
      const node = globalThis.document.activeElement, form = globalThis.document.querySelector('.cfg-page form');
      if (!node || !form.contains(node)) return null;
      const rect = node.getBoundingClientRect(), bar = form.querySelector('.settings-save-bar'), br = bar.getBoundingClientRect();
      return { tag: node.tagName, type: node.type, centerVisible: node.contains(globalThis.document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
        overlapped: !bar.contains(node) && Math.max(0, Math.min(rect.right, br.right) - Math.max(rect.left, br.left)) * Math.max(0, Math.min(rect.bottom, br.bottom) - Math.max(rect.top, br.top)) > 1 };
    });
    if (!target) break;
    assert.equal(target.centerVisible, true, `Native ${backwards ? 'Shift+Tab' : 'Tab'} target ${index} (${target.tag}/${target.type}) must be visible`);
    assert.equal(target.overlapped, false, `Save bar must not cover keyboard target ${index}`);
    checked++; await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  assert.ok(checked > 5 && checked < 180, 'Traversal must inspect controls and leave the form');
  return checked;
}
