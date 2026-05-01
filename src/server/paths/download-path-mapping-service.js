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

function createValidationError(message) {
  return new Error(message);
}

function normalizeSeparators(value) {
  return value.replaceAll('\\', '/');
}

function detectPathStyle(value) {
  if (value.startsWith('//')) {
    return 'unc';
  }

  if (/^[A-Za-z]:\//.test(value)) {
    return 'windows';
  }

  if (value.startsWith('/')) {
    return 'posix';
  }

  return 'relative';
}

function collapseSlashes(value, style) {
  if (style === 'unc') {
    return `//${value.slice(2).replace(/\/{2,}/g, '/')}`;
  }

  return value.replace(/\/{2,}/g, '/');
}

function trimTrailingSlash(value, style) {
  if (style === 'posix' && value === '/') {
    return value;
  }

  if (style === 'windows' && /^[A-Za-z]:\/$/.test(value)) {
    return value;
  }

  if (style === 'unc') {
    const segments = value.slice(2).split('/').filter(Boolean);
    if (segments.length <= 2) {
      return `//${segments.join('/')}`;
    }
  }

  return value.replace(/\/+$/g, '');
}

function normalizeAbsolutePath(value, {
  allowPosix = true,
  allowUnc = true,
  allowWindows = true,
  fieldName,
} = {}) {
  if (typeof value !== 'string') {
    throw createValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createValidationError(`${fieldName} is required`);
  }

  const normalized = trimTrailingSlash(collapseSlashes(normalizeSeparators(trimmed), detectPathStyle(normalizeSeparators(trimmed))), detectPathStyle(normalizeSeparators(trimmed)));
  const style = detectPathStyle(normalized);

  if (style === 'relative') {
    throw createValidationError(`${fieldName} must be an absolute path prefix`);
  }

  if (style === 'posix' && !allowPosix) {
    throw createValidationError(`${fieldName} must use a Windows or UNC path prefix`);
  }

  if (style === 'windows' && !allowWindows) {
    throw createValidationError(`${fieldName} must be an absolute in-container path`);
  }

  if (style === 'unc' && !allowUnc) {
    throw createValidationError(`${fieldName} must be an absolute in-container path`);
  }

  return {
    normalized,
    style,
  };
}

function normalizeRelativePath(value, fieldName) {
  if (value == null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimTrailingSlash(collapseSlashes(normalizeSeparators(trimmed), 'relative'), 'relative');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw createValidationError(`${fieldName} must not contain dot segments`);
  }

  return segments.join('/');
}

function getComparisonValue(style, value) {
  return style === 'windows' || style === 'unc'
    ? value.toLowerCase()
    : value;
}

function isPathWithin(prefix, value, style) {
  const normalizedPrefix = getComparisonValue(style, prefix);
  const normalizedValue = getComparisonValue(style, value);

  return normalizedValue === normalizedPrefix || normalizedValue.startsWith(`${normalizedPrefix}/`);
}

function getRelativePathFromPrefix(prefix, value, style) {
  if (!isPathWithin(prefix, value, style)) {
    return null;
  }

  const comparisonPrefix = getComparisonValue(style, prefix);
  const comparisonValue = getComparisonValue(style, value);
  if (comparisonPrefix === comparisonValue) {
    return '';
  }

  return value.slice(prefix.length + 1);
}

function joinNormalizedPath(prefix, relativePath = '') {
  return relativePath
    ? `${prefix.replace(/\/+$/g, '')}/${relativePath}`
    : prefix;
}

function buildPathWarning(code, message) {
  return { code, message };
}

function buildPathBlocker(code, message) {
  return { code, message };
}

function assertNonOverlappingMappings(mappings, {
  fieldName,
  key,
} = {}) {
  for (let leftIndex = 0; leftIndex < mappings.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < mappings.length; rightIndex += 1) {
      const left = mappings[leftIndex];
      const right = mappings[rightIndex];

      if (left[`${key}Style`] !== right[`${key}Style`]) {
        continue;
      }

      if (isPathWithin(left[key], right[key], left[`${key}Style`]) || isPathWithin(right[key], left[key], right[`${key}Style`])) {
        throw createValidationError(
          `${fieldName} contains overlapping ${key} values: ${left[key]} and ${right[key]}`,
        );
      }
    }
  }
}

export function normalizeDownloadPathMappings(value, {
  fieldName = 'paths.downloadMappings',
} = {}) {
  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldName} must be an array`);
  }

  const mappings = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw createValidationError(`${fieldName}[${index}] must be an object`);
    }

    const slskdPrefix = normalizeAbsolutePath(entry.slskdPrefix, {
      allowPosix: true,
      allowUnc: true,
      allowWindows: true,
      fieldName: `${fieldName}[${index}].slskdPrefix`,
    });
    const harmoniarrPrefix = normalizeAbsolutePath(entry.harmoniarrPrefix, {
      allowPosix: true,
      allowUnc: false,
      allowWindows: false,
      fieldName: `${fieldName}[${index}].harmoniarrPrefix`,
    });

    return {
      slskdPrefix: slskdPrefix.normalized,
      slskdPrefixStyle: slskdPrefix.style,
      harmoniarrPrefix: harmoniarrPrefix.normalized,
      harmoniarrPrefixStyle: harmoniarrPrefix.style,
    };
  });

  assertNonOverlappingMappings(mappings, {
    fieldName,
    key: 'slskdPrefix',
  });
  assertNonOverlappingMappings(mappings, {
    fieldName,
    key: 'harmoniarrPrefix',
  });

  return mappings;
}

export function validateDownloadPathMappingsAgainstSettings({
  downloadMappings = [],
  downloadsRoot,
} = {}) {
  const normalizedDownloadsRoot = normalizeAbsolutePath(downloadsRoot, {
    allowPosix: true,
    allowUnc: false,
    allowWindows: false,
    fieldName: 'paths.downloads',
  });
  const normalizedMappings = normalizeDownloadPathMappings(downloadMappings);

  normalizedMappings.forEach((mapping, index) => {
    if (!isPathWithin(normalizedDownloadsRoot.normalized, mapping.harmoniarrPrefix, 'posix')) {
      throw createValidationError(
        `paths.downloadMappings[${index}].harmoniarrPrefix must stay within paths.downloads`,
      );
    }
  });

  return normalizedMappings;
}

function normalizeCandidateFolderPath(value) {
  if (typeof value !== 'string') {
    return {
      isAbsolute: false,
      normalized: '',
      style: 'relative',
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      isAbsolute: false,
      normalized: '',
      style: 'relative',
    };
  }

  const normalizedPath = trimTrailingSlash(collapseSlashes(normalizeSeparators(trimmed), detectPathStyle(normalizeSeparators(trimmed))), detectPathStyle(normalizeSeparators(trimmed)));
  const style = detectPathStyle(normalizedPath);

  if (style === 'relative') {
    return {
      isAbsolute: false,
      normalized: normalizeRelativePath(normalizedPath, 'candidate.folderPath'),
      style,
    };
  }

  return {
    isAbsolute: true,
    normalized: normalizedPath,
    style,
  };
}

function createLegacyFallbackResolution({
  candidateFolderPath,
  downloadsRoot,
  isDefault,
} = {}) {
  const relativeFolderPath = normalizeRelativePath(candidateFolderPath, 'candidate.folderPath');

  return {
    blockers: [],
    matchedMapping: null,
    rawSourceFolderPath: joinNormalizedPath(downloadsRoot, relativeFolderPath),
    relativeFolderPath,
    resolvedFolderPath: joinNormalizedPath(downloadsRoot, relativeFolderPath),
    resolutionStrategy: isDefault ? 'downloads_root_default' : 'downloads_root_relative',
    warnings: [
      buildPathWarning(
        'path_mapping_assumption',
        'Preview currently assumes Harmoniarr reads candidate paths from the configured downloads root until explicit slskd path mappings are added.',
      ),
      ...(
        isDefault
          ? [buildPathWarning(
            'candidate_folder_missing',
            'Candidate folder metadata is empty, so the preview falls back to the downloads root and file names only.',
          )]
          : []
      ),
    ],
  };
}

export function resolveDownloadCandidateFolder({
  candidateFolderPath,
  downloadMappings = [],
  downloadsRoot,
} = {}) {
  const normalizedDownloadsRoot = normalizeAbsolutePath(downloadsRoot, {
    allowPosix: true,
    allowUnc: false,
    allowWindows: false,
    fieldName: 'paths.downloads',
  }).normalized;
  const normalizedMappings = normalizeDownloadPathMappings(downloadMappings);
  const candidatePath = normalizeCandidateFolderPath(candidateFolderPath);

  if (!candidatePath.normalized) {
    if (normalizedMappings.length === 1) {
      const mapping = normalizedMappings[0];
      return {
        blockers: [],
        matchedMapping: {
          harmoniarrPrefix: mapping.harmoniarrPrefix,
          slskdPrefix: mapping.slskdPrefix,
        },
        rawSourceFolderPath: mapping.slskdPrefix,
        relativeFolderPath: '',
        resolvedFolderPath: mapping.harmoniarrPrefix,
        resolutionStrategy: 'mapping_relative_candidate',
        warnings: [buildPathWarning(
          'candidate_folder_missing',
          'Candidate folder metadata is empty, so the preview falls back to the mapping root and file names only.',
        )],
      };
    }

    return createLegacyFallbackResolution({
      candidateFolderPath: '',
      downloadsRoot: normalizedDownloadsRoot,
      isDefault: true,
    });
  }

  if (candidatePath.isAbsolute) {
    const matchedMapping = normalizedMappings.find((mapping) => (
      mapping.slskdPrefixStyle === candidatePath.style
      && isPathWithin(mapping.slskdPrefix, candidatePath.normalized, candidatePath.style)
    ));

    if (matchedMapping) {
      const relativeFolderPath = getRelativePathFromPrefix(matchedMapping.slskdPrefix, candidatePath.normalized, candidatePath.style) ?? '';
      return {
        blockers: [],
        matchedMapping: {
          harmoniarrPrefix: matchedMapping.harmoniarrPrefix,
          slskdPrefix: matchedMapping.slskdPrefix,
        },
        rawSourceFolderPath: candidatePath.normalized,
        relativeFolderPath,
        resolvedFolderPath: joinNormalizedPath(matchedMapping.harmoniarrPrefix, relativeFolderPath),
        resolutionStrategy: 'mapping_absolute_source',
        warnings: [],
      };
    }

    if (normalizedMappings.length === 0 && candidatePath.style === 'posix' && isPathWithin(normalizedDownloadsRoot, candidatePath.normalized, 'posix')) {
      const relativeFolderPath = getRelativePathFromPrefix(normalizedDownloadsRoot, candidatePath.normalized, 'posix') ?? '';
      return {
        blockers: [],
        matchedMapping: null,
        rawSourceFolderPath: candidatePath.normalized,
        relativeFolderPath,
        resolvedFolderPath: candidatePath.normalized,
        resolutionStrategy: 'downloads_root_absolute',
        warnings: [buildPathWarning(
          'path_mapping_assumption',
          'Preview currently trusts the configured downloads root because no explicit slskd path mappings are configured yet.',
        )],
      };
    }

    return {
      blockers: [buildPathBlocker(
        'unmapped_slskd_source_path',
        'Candidate preview could not translate the stored source path through the configured slskd download mappings.',
      )],
      matchedMapping: null,
      rawSourceFolderPath: candidatePath.normalized,
      relativeFolderPath: '',
      resolvedFolderPath: null,
      resolutionStrategy: 'unresolved',
      warnings: [],
    };
  }

  if (normalizedMappings.length === 1) {
    const mapping = normalizedMappings[0];
    return {
      blockers: [],
      matchedMapping: {
        harmoniarrPrefix: mapping.harmoniarrPrefix,
        slskdPrefix: mapping.slskdPrefix,
      },
      rawSourceFolderPath: joinNormalizedPath(mapping.slskdPrefix, candidatePath.normalized),
      relativeFolderPath: candidatePath.normalized,
      resolvedFolderPath: joinNormalizedPath(mapping.harmoniarrPrefix, candidatePath.normalized),
      resolutionStrategy: 'mapping_relative_candidate',
      warnings: [],
    };
  }

  if (normalizedMappings.length > 1) {
    return {
      blockers: [buildPathBlocker(
        'ambiguous_relative_candidate_path',
        'Candidate preview cannot choose between multiple configured download mappings when the stored candidate path is relative.',
      )],
      matchedMapping: null,
      rawSourceFolderPath: null,
      relativeFolderPath: candidatePath.normalized,
      resolvedFolderPath: null,
      resolutionStrategy: 'unresolved',
      warnings: [],
    };
  }

  return createLegacyFallbackResolution({
    candidateFolderPath: candidatePath.normalized,
    downloadsRoot: normalizedDownloadsRoot,
    isDefault: false,
  });
}