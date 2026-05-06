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

/**
 * color-worker.js — Dedicated web worker for dominant OKLCH color extraction.
 *
 * Receives { id, bitmap } (ImageBitmap transferred from main thread), draws to a
 * 16×16 OffscreenCanvas, converts every pixel through the sRGB → OKLCH pipeline,
 * filters for vibrant pixels (C ≥ 0.05), finds the largest hue cluster within
 * ±30°, and returns the chroma-weighted centroid of that cluster.
 *
 * On any error, posts { id, hue: null, chroma: null, lightness: null } so callers
 * always receive a resolved message.
 *
 * Safari guard: OffscreenCanvas is checked at message-receive time.
 */

const VIBRANCY_THRESHOLD = 0.05;
const CANVAS_SIZE = 16;
const HUE_CLUSTER_HALF_WIDTH = 30; // degrees

// --- OKLCH conversion (inlined — no import available inside a worker module) ---

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToOklch(r, g, b) {
  const lr = linearize(r / 255);
  const lg = linearize(g / 255);
  const lb = linearize(b / 255);

  const lp = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const mp = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const sp = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const okl = 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp;
  const oka = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp;
  const okb = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp;

  const c = Math.sqrt(oka * oka + okb * okb);
  const h = ((Math.atan2(okb, oka) * 180) / Math.PI + 360) % 360;

  return { l: okl, c, h };
}

// --- Main message handler ---

self.onmessage = function (event) {
  const { id, bitmap } = event.data;

  // Safari / older browsers that don't support OffscreenCanvas
  if (typeof OffscreenCanvas === 'undefined') {
    self.postMessage({ id, hue: null, chroma: null, lightness: null });
    return;
  }

  try {
    const canvas = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const pixels = imageData.data; // Uint8ClampedArray, RGBA per pixel

    // Convert all 256 pixels; keep vibrant ones
    const vibrant = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // ignore fully transparent pixels
      if (pixels[i + 3] === 0) continue;
      const { l, c, h } = rgbToOklch(r, g, b);
      if (c >= VIBRANCY_THRESHOLD) {
        vibrant.push({ l, c, h });
      }
    }

    if (vibrant.length === 0) {
      self.postMessage({ id, hue: null, chroma: null, lightness: null });
      return;
    }

    // Sort by hue to enable a sliding-window cluster search
    vibrant.sort((a, b) => a.h - b.h);

    // Find the hue cluster with the most members within ±HUE_CLUSTER_HALF_WIDTH degrees.
    // The search is over all center candidates (each pixel's hue as the center).
    // Hue is circular; we handle wrap-around by testing the doubled array or by using
    // angular distance.
    let bestClusterIndices = [];
    let bestCount = 0;

    for (let i = 0; i < vibrant.length; i++) {
      const center = vibrant[i].h;
      const members = [];
      for (let j = 0; j < vibrant.length; j++) {
        const diff = Math.abs(vibrant[j].h - center);
        const angularDiff = diff > 180 ? 360 - diff : diff;
        if (angularDiff <= HUE_CLUSTER_HALF_WIDTH) {
          members.push(j);
        }
      }
      if (members.length > bestCount) {
        bestCount = members.length;
        bestClusterIndices = members;
      }
    }

    // Chroma-weighted centroid of the best cluster
    // Hue averaging is done in Cartesian space (atan2 of summed unit vectors)
    // to handle wrap-around correctly.
    let totalWeight = 0;
    let sinSum = 0;
    let cosSum = 0;
    let chromaSum = 0;
    let lightnessSum = 0;

    for (const idx of bestClusterIndices) {
      const { l, c, h } = vibrant[idx];
      const weight = c; // chroma as weight
      const hRad = (h * Math.PI) / 180;
      sinSum += Math.sin(hRad) * weight;
      cosSum += Math.cos(hRad) * weight;
      chromaSum += c * weight;
      lightnessSum += l * weight;
      totalWeight += weight;
    }

    const avgH = ((Math.atan2(sinSum / totalWeight, cosSum / totalWeight) * 180) / Math.PI + 360) % 360;
    const avgC = chromaSum / totalWeight;
    const avgL = lightnessSum / totalWeight;

    self.postMessage({
      id,
      hue: Math.round(avgH * 100) / 100,
      chroma: Math.round(avgC * 10000) / 10000,
      lightness: Math.round(avgL * 10000) / 10000,
    });
  } catch {
    self.postMessage({ id, hue: null, chroma: null, lightness: null });
  }
};
