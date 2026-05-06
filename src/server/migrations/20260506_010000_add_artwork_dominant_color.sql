-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

-- Add dominant OKLCH color components to artwork_assets for theme-adaptive card accents.
--
-- dominant_hue / dominant_chroma: extracted at ingest time via sharp.stats() histogram.
-- dominant_lightness: reference only — card CSS derives theme-appropriate L at render time
--   (0.72 dark, 0.38 light) so the border is always legible regardless of artwork origin.
-- dominant_hex: STORED generated column for API compatibility. Computed by oklch_to_hex().
--
-- A vibrancy gate (C >= 0.05) at ingest time ensures near-grey artwork leaves all four
-- columns NULL rather than storing achromatic values that produce no visible accent.
--
-- No backfill is required. Pre-migration assets receive values via client-side worker
-- write-back (PATCH /api/v1/artwork/assets/:id/dominant-color, WHERE dominant_hue IS NULL)
-- on first Library view load. After first write-back the worker never fires for that asset.

-- OKLCH → linear sRGB → gamma-compressed sRGB → 6-character hex string.
-- IMMUTABLE STRICT: output depends only on inputs; returns NULL when any input is NULL.
-- PARALLEL SAFE: no shared state.
-- Used by the dominant_hex generated column below.
CREATE OR REPLACE FUNCTION oklch_to_hex(l_in NUMERIC, c_in NUMERIC, h_in NUMERIC)
RETURNS VARCHAR(7)
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  WITH
  -- Step 1: OKLCH → Oklab (a, b components from hue angle and chroma)
  ab AS (
    SELECT
      (c_in * cos(radians(h_in::double precision)))::numeric AS a_ok,
      (c_in * sin(radians(h_in::double precision)))::numeric AS b_ok
  ),
  -- Step 2: Oklab → LMS cube-roots (the Björn Ottosson M1 matrix, inverted)
  lms_prime AS (
    SELECT
      l_in + 0.3963377774 * ab.a_ok + 0.2158037573 * ab.b_ok AS lp,
      l_in - 0.1055613458 * ab.a_ok - 0.0638541728 * ab.b_ok AS mp,
      l_in - 0.0894841775 * ab.a_ok - 1.2914855480 * ab.b_ok AS sp
    FROM ab
  ),
  -- Step 3: cube-root → cube to recover linear LMS
  lms AS (
    SELECT lp ^ 3 AS l, mp ^ 3 AS m, sp ^ 3 AS s FROM lms_prime
  ),
  -- Step 4: linear LMS → linear sRGB (Ottosson M2 matrix), clamped to [0, 1]
  lin AS (
    SELECT
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        ( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)::double precision)) AS r,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)::double precision)) AS g,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)::double precision)) AS b
    FROM lms
  ),
  -- Step 5: linear sRGB → gamma-compressed sRGB (IEC 61966-2-1 transfer function)
  srgb AS (
    SELECT
      CASE WHEN r <= 0.0031308 THEN 12.92 * r ELSE 1.055 * r ^ (1.0 / 2.4) - 0.055 END AS r8,
      CASE WHEN g <= 0.0031308 THEN 12.92 * g ELSE 1.055 * g ^ (1.0 / 2.4) - 0.055 END AS g8,
      CASE WHEN b <= 0.0031308 THEN 12.92 * b ELSE 1.055 * b ^ (1.0 / 2.4) - 0.055 END AS b8
    FROM lin
  )
  -- Step 6: scale to [0, 255], round, format as lowercase hex with leading-zero padding
  SELECT
    '#' ||
    LPAD(TO_HEX(ROUND(r8 * 255)::integer), 2, '0') ||
    LPAD(TO_HEX(ROUND(g8 * 255)::integer), 2, '0') ||
    LPAD(TO_HEX(ROUND(b8 * 255)::integer), 2, '0')
  FROM srgb
$$;

-- Three nullable OKLCH component columns.
-- dominant_lightness stored as reference; CSS uses fixed theme-appropriate L values.
ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hue       NUMERIC(6,2) NULL, -- degrees 0–360
  ADD COLUMN IF NOT EXISTS dominant_chroma    NUMERIC(6,4) NULL, -- OKLCH C, approx 0.0–0.4
  ADD COLUMN IF NOT EXISTS dominant_lightness NUMERIC(6,4) NULL; -- OKLCH L, 0.0–1.0 (reference)

-- Generated backward-compatibility column so existing API consumers reading dominant_hex
-- continue to work without changes during the migration period.
ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hex VARCHAR(7)
    GENERATED ALWAYS AS (oklch_to_hex(dominant_lightness, dominant_chroma, dominant_hue)) STORED;
