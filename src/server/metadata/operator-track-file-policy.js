/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { isAudioFileExtension } from '../library/library-file-type-policy.js';
import { isSupportedOperatorTrackScope, OPERATOR_TRACK_SCOPE_BLOCKER } from './operator-track-scope-policy.js';

export const refuseOperatorTrackFiles = () => createApiError(409, OPERATOR_TRACK_SCOPE_BLOCKER,
  'Selected tracks need an exact file match and verified media before import');
const title = value => typeof value === 'string' ? value.normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim() : '';
const tagPosition = value => typeof value === 'string' && /^[1-9]\d*(?:\/[1-9]\d*)?$/u.test(value) ? Number(value.split('/')[0]) : null;

export function getCandidateTrackContext(candidate) {
  return candidate?.normalizedPayload?.musicQueue ?? candidate?.normalizedPayload?.musicQueueContext;
}

// This first slice deliberately admits one track on disc one. Shared owners must
// request the identical subset; a full-release or different subset is not dropped.
export function getSingleTrackRequirement(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) throw refuseOperatorTrackFiles();
  const first = scopes[0]?.scope;
  if (!isSupportedOperatorTrackScope(first) || first.mode !== 'tracks') throw refuseOperatorTrackFiles();
  if (scopes.some(entry => !isDeepStrictEqual(entry?.scope, first))) throw refuseOperatorTrackFiles();
  return first.tracks[0];
}

export function remoteTrackFilename(file) {
  if (typeof file?.rawPayload?.filename === 'string' && file.rawPayload.filename.trim()) return file.rawPayload.filename.trim();
  return file?.folderPath ? `${file.folderPath.replaceAll('/', '\\')}\\${file.filename}` : file?.filename;
}

export function selectOperatorTrackFiles(candidate) {
  const context = getCandidateTrackContext(candidate);
  if (!Object.hasOwn(context ?? {}, 'operatorTrackScopes')) return null;
  const scopes = context.operatorTrackScopes;
  if (!Array.isArray(scopes) || scopes.length === 0) throw refuseOperatorTrackFiles();
  if (scopes.every(entry => entry?.scope?.mode === 'release')) return null;
  const track = getSingleTrackRequirement(scopes);
  const matches = (candidate.files ?? []).filter(file => {
    if (!isAudioFileExtension(file.extension)) return false;
    const match = /^(\d{1,3})[ ._-]+(.+)\.[^.]+$/u.exec(file.filename ?? '');
    return match && Number(match[1]) === track.trackPosition && title(match[2]) === title(track.title);
  });
  if (matches.length !== 1) throw refuseOperatorTrackFiles();
  const file = matches[0];
  const remote = remoteTrackFilename(file)?.replaceAll('/', '\\');
  const expectedRemote = file.folderPath ? `${file.folderPath.replaceAll('/', '\\')}\\${file.filename}` : file.filename;
  if (!file.id || file.isLocked || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0
    || remote !== expectedRemote || remote.split('\\').some(segment => segment === '..' || segment === '.')
    || !Number.isFinite(file.lengthSeconds) || !Number.isFinite(track.lengthMs) || track.lengthMs <= 0
    || Math.abs(file.lengthSeconds - track.lengthMs / 1000) > 2) throw refuseOperatorTrackFiles();
  return { scope: scopes[0].scope, files: [file], bindings: [{ fileId: file.id, track: structuredClone(track) }] };
}

export function assertOperatorTrackManifest(selection, requestedFiles) {
  if (!selection) return;
  const expected = selection.files.map(file => ({ filename: remoteTrackFilename(file), size: file.sizeBytes }));
  if (!isDeepStrictEqual(expected, requestedFiles)) throw refuseOperatorTrackFiles();
}

export function assertOperatorTrackMedia({ track, inspection, releaseMbid }) {
  const metadata = inspection?.metadata;
  const tags = metadata?.tags;
  if (metadata?.audioStreamCount !== 1 || metadata?.videoStreamCount !== 0
    || !releaseMbid || tags?.musicbrainz_albumid !== releaseMbid
    || title(tags?.title) !== title(track.title) || tags?.musicbrainz_trackid !== track.recordingMbid
    || tagPosition(tags?.track ?? tags?.tracknumber) !== track.trackPosition
    || tagPosition(tags?.disc ?? tags?.discnumber) !== track.mediumPosition
    || !Number.isFinite(metadata.durationSeconds) || !Number.isFinite(track.lengthMs) || track.lengthMs <= 0
    || Math.abs(metadata.durationSeconds - track.lengthMs / 1000) > 2) throw refuseOperatorTrackFiles();
}

export function hasOwnerTrackFulfillment({ request, candidate }) {
  const scope = request?.evidence?.operatorArtistReconciliation?.operatorTrackScope;
  const receipt = candidate?.normalizedPayload?.operatorTrackFulfillment;
  const ownerId = request?.requestedForUser?.id ?? request?.requestedForUserId ?? request?.requestedByUser?.id;
  return isSupportedOperatorTrackScope(scope) && scope.mode === 'tracks' && candidate?.status === 'applied'
    && receipt?.version === 1 && receipt.ownerId === ownerId && Boolean(ownerId)
    && receipt.sourceMediaRequestId === request.id && isDeepStrictEqual(receipt.scope, scope)
    && receipt.files?.length === 1 && Boolean(receipt.files[0].libraryPath)
    && /^[a-f0-9]{64}$/u.test(receipt.files[0].evidence?.sha256 ?? '') && receipt.files[0].evidence?.sizeBytes > 0
    && isDeepStrictEqual(receipt.files[0].track, scope.tracks[0]);
}
