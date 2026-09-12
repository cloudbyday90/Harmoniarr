/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';

/** Measure rendered CSS colors, including modern color(srgb ...) syntax and transparent surfaces. */
export async function assertComputedColorContrast(locator, { minimumRatio = 4.5, kind = 'text', label = 'Color contrast' } = {}) {
  await locator.waitFor({ state: 'visible' });
  const result = await locator.evaluate((element, measurementKind) => {
    const view = element.ownerDocument.defaultView;
    const canvas = element.ownerDocument.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    function rgba(color) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }
    function composite(foreground, background) {
      const alpha = foreground[3] / 255;
      return [0, 1, 2].map((channel) => foreground[channel] * alpha + background[channel] * (1 - alpha));
    }
    const layers = [];
    let ancestor = measurementKind === 'outline' ? element.parentElement : element;
    while (ancestor) {
      const color = rgba(view.getComputedStyle(ancestor).backgroundColor);
      layers.push(color);
      if (color[3] === 255) break;
      ancestor = ancestor.parentElement;
    }
    const background = layers.reverse().reduce((accumulator, color) => composite(color, accumulator), [255, 255, 255]);
    const style = view.getComputedStyle(element);
    const rawForeground = measurementKind === 'outline' ? style.outlineColor : style.color;
    const foreground = composite(rgba(rawForeground), background);
    function luminance(color) {
      const linear = color.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    const values = [luminance(foreground), luminance(background)].sort((left, right) => left - right);
    return { ratio: (values[1] + 0.05) / (values[0] + 0.05), foreground: rawForeground, background };
  }, kind);
  assert.ok(result.ratio >= minimumRatio,
    `${label}: ${result.ratio.toFixed(2)}:1 is below ${minimumRatio}:1; foreground ${result.foreground}, background rgb(${result.background.join(', ')})`);
  return result;
}
