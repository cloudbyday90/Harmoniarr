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

CREATE TABLE IF NOT EXISTS metadata_artists (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  source_provider TEXT NOT NULL,
  source_artist_id TEXT NOT NULL,
  musicbrainz_artist_id UUID NULL,
  name TEXT NOT NULL,
  sort_name TEXT NULL,
  disambiguation TEXT NULL,
  country TEXT NULL,
  artist_type TEXT NULL,
  begin_date TEXT NULL,
  end_date TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_artist_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_artists_musicbrainz_artist_id_unique
  ON metadata_artists (musicbrainz_artist_id)
  WHERE musicbrainz_artist_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_artist_aliases (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  locale TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_artist_aliases_artist_alias_locale_unique
  ON metadata_artist_aliases (metadata_artist_id, alias, COALESCE(locale, ''));

CREATE INDEX IF NOT EXISTS metadata_artist_aliases_artist_lookup_idx
  ON metadata_artist_aliases (metadata_artist_id, is_primary DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_release_groups (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_release_group_id TEXT NOT NULL,
  musicbrainz_release_group_id UUID NULL,
  title TEXT NOT NULL,
  primary_type TEXT NULL,
  secondary_types TEXT[] NOT NULL DEFAULT '{}',
  first_release_date TEXT NULL,
  disambiguation TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_release_group_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_release_groups_musicbrainz_release_group_id_unique
  ON metadata_release_groups (musicbrainz_release_group_id)
  WHERE musicbrainz_release_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS metadata_release_groups_artist_lookup_idx
  ON metadata_release_groups (metadata_artist_id, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_releases (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_release_id TEXT NOT NULL,
  musicbrainz_release_id UUID NULL,
  title TEXT NOT NULL,
  status TEXT NULL,
  release_date TEXT NULL,
  country TEXT NULL,
  barcode TEXT NULL,
  disambiguation TEXT NULL,
  track_count INTEGER NULL CHECK (track_count IS NULL OR track_count >= 0),
  medium_count INTEGER NULL CHECK (medium_count IS NULL OR medium_count >= 0),
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_release_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_releases_musicbrainz_release_id_unique
  ON metadata_releases (musicbrainz_release_id)
  WHERE musicbrainz_release_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS metadata_releases_release_group_lookup_idx
  ON metadata_releases (metadata_release_group_id, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_media (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NULL,
  format TEXT NULL,
  track_count INTEGER NULL CHECK (track_count IS NULL OR track_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id, position)
);

CREATE INDEX IF NOT EXISTS metadata_media_release_lookup_idx
  ON metadata_media (metadata_release_id, position ASC);

CREATE TABLE IF NOT EXISTS metadata_recordings (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  source_provider TEXT NOT NULL,
  source_recording_id TEXT NOT NULL,
  musicbrainz_recording_id UUID NULL,
  title TEXT NOT NULL,
  length_ms INTEGER NULL CHECK (length_ms IS NULL OR length_ms >= 0),
  artist_credit TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_recording_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_recordings_musicbrainz_recording_id_unique
  ON metadata_recordings (musicbrainz_recording_id)
  WHERE musicbrainz_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_tracks (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_medium_id UUID NOT NULL REFERENCES metadata_media(id) ON DELETE CASCADE,
  metadata_recording_id UUID NULL REFERENCES metadata_recordings(id) ON DELETE SET NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  number_text TEXT NULL,
  title TEXT NOT NULL,
  length_ms INTEGER NULL CHECK (length_ms IS NULL OR length_ms >= 0),
  artist_credit TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_medium_id, position)
);

CREATE INDEX IF NOT EXISTS metadata_tracks_medium_lookup_idx
  ON metadata_tracks (metadata_medium_id, position ASC);

CREATE INDEX IF NOT EXISTS metadata_tracks_recording_lookup_idx
  ON metadata_tracks (metadata_recording_id)
  WHERE metadata_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_provider_snapshots (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  source_identifier TEXT NULL,
  payload_checksum TEXT NULL,
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metadata_provider_snapshots_entity_lookup_idx
  ON metadata_provider_snapshots (provider, entity_type, entity_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS metadata_provider_snapshots_source_identifier_lookup_idx
  ON metadata_provider_snapshots (provider, source_identifier, fetched_at DESC)
  WHERE source_identifier IS NOT NULL;