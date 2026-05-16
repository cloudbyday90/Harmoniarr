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

import { getPool } from '../database.js';

function resolveQueryable(queryable) {
  return queryable ?? getPool();
}

function mapArtworkAssetRow(row) {
  if (!row) {
    return null;
  }

  return {
    createdAt: row.created_at,
    fetchedAt: row.fetched_at,
    fileSizeBytes: Number(row.file_size_bytes),
    height: row.height,
    id: row.id,
    lastVerifiedAt: row.last_verified_at,
    mimeType: row.mime_type,
    payloadChecksum: row.payload_checksum,
    relativePath: row.relative_path,
    sha256: row.sha256,
    sourceProvider: row.source_provider,
    sourceUrl: row.source_url,
    storageClass: row.storage_class,
    storageNamespace: row.storage_namespace,
    dominantChroma: row.dominant_chroma !== null && row.dominant_chroma !== undefined ? Number(row.dominant_chroma) : null,
    dominantHex: row.dominant_hex ?? null,
    dominantHue: row.dominant_hue !== null && row.dominant_hue !== undefined ? Number(row.dominant_hue) : null,
    dominantLightness: row.dominant_lightness !== null && row.dominant_lightness !== undefined ? Number(row.dominant_lightness) : null,
    unassignedAt: row.unassigned_at,
    updatedAt: row.updated_at,
    width: row.width,
  };
}

function mapArtworkAssignmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    artworkAssetId: row.artwork_asset_id,
    artworkRole: row.artwork_role,
    createdAt: row.created_at,
    id: row.id,
    isPreferred: row.is_preferred,
    observedAt: row.observed_at,
    ownerId: row.owner_id,
    ownerType: row.owner_type,
    priority: row.priority,
    sourceProvider: row.source_provider,
    sourceReference: row.source_reference,
    updatedAt: row.updated_at,
  };
}

export async function upsertArtworkAsset(asset, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO artwork_assets (
        storage_namespace,
        relative_path,
        sha256,
        mime_type,
        file_size_bytes,
        width,
        height,
        storage_class,
        source_provider,
        source_url,
        payload_checksum,
        fetched_at,
        last_verified_at,
        dominant_hue,
        dominant_chroma,
        dominant_lightness,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (sha256) DO UPDATE
      SET storage_namespace = EXCLUDED.storage_namespace,
          relative_path = EXCLUDED.relative_path,
          mime_type = EXCLUDED.mime_type,
          file_size_bytes = EXCLUDED.file_size_bytes,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          storage_class = EXCLUDED.storage_class,
          source_provider = EXCLUDED.source_provider,
          source_url = EXCLUDED.source_url,
          payload_checksum = EXCLUDED.payload_checksum,
          fetched_at = EXCLUDED.fetched_at,
          last_verified_at = EXCLUDED.last_verified_at,
          dominant_hue = COALESCE(EXCLUDED.dominant_hue, artwork_assets.dominant_hue),
          dominant_chroma = COALESCE(EXCLUDED.dominant_chroma, artwork_assets.dominant_chroma),
          dominant_lightness = COALESCE(EXCLUDED.dominant_lightness, artwork_assets.dominant_lightness),
          updated_at = NOW()
      RETURNING *
    `,
    [
      asset.storageNamespace,
      asset.relativePath,
      asset.sha256,
      asset.mimeType,
      asset.fileSizeBytes,
      asset.width ?? null,
      asset.height ?? null,
      asset.storageClass,
      asset.sourceProvider ?? null,
      asset.sourceUrl ?? null,
      asset.payloadChecksum ?? null,
      asset.fetchedAt ?? null,
      asset.lastVerifiedAt ?? null,
      asset.dominantHue ?? null,
      asset.dominantChroma ?? null,
      asset.dominantLightness ?? null,
    ],
  );

  return mapArtworkAssetRow(result.rows[0]);
}

export async function getArtworkAssetBySha256(sha256, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM artwork_assets WHERE sha256 = $1 LIMIT 1',
    [sha256],
  );

  return mapArtworkAssetRow(result.rows[0]);
}

export async function getArtworkAssetById(id, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM artwork_assets WHERE id = $1 LIMIT 1',
    [id],
  );

  return mapArtworkAssetRow(result.rows[0]);
}

export async function patchArtworkDominantColor({ assetId, hue, chroma, lightness }, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `UPDATE artwork_assets
     SET dominant_hue = $2, dominant_chroma = $3, dominant_lightness = $4, updated_at = NOW()
     WHERE id = $1 AND dominant_hue IS NULL
     RETURNING id`,
    [assetId, hue, chroma, lightness],
  );

  return result.rowCount > 0;
}

export async function listArtworkCleanupCandidates({
  limit = 100,
  storageClasses = ['provider_original', 'extracted_embedded', 'embedded_extract'],
  unassignedBefore,
} = {}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT assets.*
      FROM artwork_assets AS assets
      WHERE assets.unassigned_at IS NOT NULL
        AND assets.unassigned_at <= $1
        AND assets.storage_class = ANY($2)
        AND NOT EXISTS (
          SELECT 1
          FROM artwork_assignments AS assignments
          WHERE assignments.artwork_asset_id = assets.id
        )
      ORDER BY assets.unassigned_at ASC, assets.created_at ASC, assets.id ASC
      LIMIT $3
    `,
    [unassignedBefore, storageClasses, limit],
  );

  return result.rows.map(mapArtworkAssetRow);
}

export async function getArtworkCleanupSnapshot({
  storageClasses = ['provider_original', 'extracted_embedded', 'embedded_extract'],
  unassignedBefore,
} = {}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE assets.unassigned_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM artwork_assignments AS assignments
              WHERE assignments.artwork_asset_id = assets.id
            )
        )::integer AS unassigned_asset_count,
        COUNT(*) FILTER (
          WHERE assets.unassigned_at IS NOT NULL
            AND assets.unassigned_at <= $1
            AND assets.storage_class = ANY($2)
            AND NOT EXISTS (
              SELECT 1
              FROM artwork_assignments AS assignments
              WHERE assignments.artwork_asset_id = assets.id
            )
        )::integer AS eligible_asset_count,
        MIN(assets.unassigned_at) FILTER (
          WHERE assets.unassigned_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM artwork_assignments AS assignments
              WHERE assignments.artwork_asset_id = assets.id
            )
        ) AS oldest_unassigned_at
      FROM artwork_assets AS assets
    `,
    [unassignedBefore, storageClasses],
  );

  return {
    eligibleAssetCount: Number(result.rows[0]?.eligible_asset_count ?? 0),
    oldestUnassignedAt: result.rows[0]?.oldest_unassigned_at ?? null,
    unassignedAssetCount: Number(result.rows[0]?.unassigned_asset_count ?? 0),
  };
}

export async function refreshArtworkAssetAssignmentState(artworkAssetIds, queryable) {
  const normalizedArtworkAssetIds = Array.isArray(artworkAssetIds)
    ? artworkAssetIds.filter((artworkAssetId) => typeof artworkAssetId === 'string' && artworkAssetId.trim().length > 0)
    : [];

  if (normalizedArtworkAssetIds.length === 0) {
    return [];
  }

  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      UPDATE artwork_assets AS assets
      SET unassigned_at = CASE
            WHEN EXISTS (
              SELECT 1
              FROM artwork_assignments AS assignments
              WHERE assignments.artwork_asset_id = assets.id
            ) THEN NULL
            ELSE COALESCE(assets.unassigned_at, NOW())
          END,
          updated_at = NOW()
      WHERE assets.id = ANY($1::uuid[])
      RETURNING *
    `,
    [normalizedArtworkAssetIds],
  );

  return result.rows.map(mapArtworkAssetRow);
}

export async function deleteArtworkAssetById(id, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      DELETE FROM artwork_assets
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return mapArtworkAssetRow(result.rows[0]);
}

export async function listArtworkAssignments({ ownerId, ownerType }, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM artwork_assignments
      WHERE owner_type = $1
        AND owner_id = $2
      ORDER BY is_preferred DESC, priority ASC, created_at ASC, id ASC
    `,
    [ownerType, ownerId],
  );

  return result.rows.map(mapArtworkAssignmentRow);
}

export async function upsertArtworkAssignment(assignment, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO artwork_assignments (
        artwork_asset_id,
        owner_type,
        owner_id,
        artwork_role,
        source_provider,
        source_reference,
        is_preferred,
        priority,
        observed_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (owner_type, owner_id, artwork_role, artwork_asset_id) DO UPDATE
      SET source_provider = EXCLUDED.source_provider,
          source_reference = EXCLUDED.source_reference,
          is_preferred = EXCLUDED.is_preferred,
          priority = EXCLUDED.priority,
          observed_at = EXCLUDED.observed_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      assignment.artworkAssetId,
      assignment.ownerType,
      assignment.ownerId,
      assignment.artworkRole,
      assignment.sourceProvider ?? null,
      assignment.sourceReference ?? null,
      assignment.isPreferred ?? false,
      assignment.priority ?? 100,
      assignment.observedAt ?? null,
    ],
  );

  return mapArtworkAssignmentRow(result.rows[0]);
}

export async function deleteStaleArtworkAssignments({ artworkRole, exceptArtworkAssetId, ownerId, ownerType }, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      DELETE FROM artwork_assignments
      WHERE owner_type = $1
        AND owner_id = $2
        AND artwork_role = $3
        AND artwork_asset_id <> $4
      RETURNING artwork_asset_id
    `,
    [ownerType, ownerId, artworkRole, exceptArtworkAssetId],
  );

  return result.rows.map((row) => row.artwork_asset_id);
}