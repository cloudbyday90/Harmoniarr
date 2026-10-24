/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seedMetadataReleaseFixture } from '../integration/metadata-fixtures.js';

/** Synthetic stopped acquisitions, not claims about provider/audio measurement. */
export async function seedDeploymentReviewCatalog({ pool, appUserId }) {
  const targets = {};
  for (const [label, weak, eligible, offset] of [['navigation', 401, 13, 0], ['restart', 600, 0, 10_000]]) {
    const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Review qualification ${label}`, releaseTitle: label });
    const wanted = (await pool.query(`INSERT INTO library_wanted_releases
      (app_user_id,metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
      VALUES($1,$2,$3,$4,'missing',1,0,1) RETURNING id`, [appUserId, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId])).rows[0];
    const searchId = `mixed-review-${wanted.id}`;
    const discovery = (await pool.query(`INSERT INTO library_discovery_requests
      (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,evidence)
      VALUES($1,$2,$3,'missing','automatic','blocked',jsonb_build_object('lastSearchId',$4::text)) RETURNING id`,
    [metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId, searchId])).rows[0];
    await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [discovery.id, wanted.id]);
    const context = { musicQueue: { profileCode: 'lossless_archive', wantedReleaseId: wanted.id } };
    const failed = (await pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
      VALUES('mixed-review',$1,'failed','private-fixture-peer','/private/fixture','failed',$2::jsonb,$3::jsonb,NOW()) RETURNING id`,
    [searchId, JSON.stringify({ unrelated: randomBytes(64 * 1024).toString('hex') }), JSON.stringify(context)])).rows[0];
    await pool.query(`INSERT INTO import_candidate_events(import_candidate_id,event_type,details,occurred_at)
      VALUES($1,'import_candidate_import_blocked','{"addBlockerCode":"media_verification","recoveryReasonCode":"suspicious_lossless"}',NOW())`, [failed.id]);
    await pool.query(`INSERT INTO import_candidate_files(import_candidate_id,source_file_index,filename,folder_path,extension,size_bytes,raw_payload)
      SELECT $1,n,'private-'||n||'.flac','/private/fixture','flac',1,jsonb_build_object('unrelated',repeat('x',128)) FROM generate_series(1,2048) n`, [failed.id]);
    await pool.query(`INSERT INTO import_candidates(id,source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,file_count,total_size_bytes,discovered_at)
      SELECT ('30000000-0000-4000-8000-'||lpad((n+$5)::text,12,'0'))::uuid,'mixed-review',$1,'choice-'||n,'private-fixture-peer','/private/fixture','pending','{}',
        $2::jsonb||jsonb_build_object('extensions',jsonb_build_array(CASE WHEN n<=$3 THEN 'mp3' ELSE 'flac' END)),1,50000000,NOW()
      FROM generate_series(1,$4::int) n`, [searchId, JSON.stringify(context), weak, weak + eligible, offset]);
    targets[label] = { wantedReleaseId: wanted.id, failedCandidateId: failed.id, discoveryId: discovery.id, searchId };
  }
  const corpus = (await pool.query(`SELECT
    (SELECT count(*)::int FROM import_candidates WHERE source_provider='mixed-review' AND status='failed') AS failed,
    (SELECT count(*)::int FROM import_candidates WHERE source_provider='mixed-review' AND status='pending') AS alternatives,
    (SELECT count(*)::int FROM import_candidate_files files JOIN import_candidates candidate ON candidate.id=files.import_candidate_id
      WHERE candidate.source_provider='mixed-review') AS files`)).rows[0];
  assert.deepEqual(corpus, { failed: 2, alternatives: 1014, files: 4096 });
  return { targets, corpus };
}
