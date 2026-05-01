import { readFile, writeFile } from 'node:fs/promises';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseGitHubEnvironmentFile(text) {
  if (typeof text !== 'string') {
    throw new Error('environment file text is required');
  }

  const normalizedText = text.replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  const values = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const heredocMatch = line.match(/^([^=]+)<<(.+)$/);
    if (heredocMatch) {
      const [, name, marker] = heredocMatch;
      const contentLines = [];
      let foundMarker = false;

      for (index += 1; index < lines.length; index += 1) {
        if (lines[index] === marker) {
          foundMarker = true;
          break;
        }

        contentLines.push(lines[index]);
      }

      if (!foundMarker) {
        throw new Error(`Missing heredoc marker ${marker} for ${name}`);
      }

      values[name] = contentLines.join('\n');
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Invalid environment file line: ${line}`);
    }

    values[line.slice(0, equalsIndex)] = line.slice(equalsIndex + 1);
  }

  return values;
}

export async function parseGitHubEnvironmentFileFromPath(filePath) {
  return parseGitHubEnvironmentFile(await readFile(filePath, 'utf8'));
}

export function createReleaseViewFixture(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('metadata must be an object');
  }

  return {
    assets: Object.values(metadata.assets ?? {})
      .filter(isNonEmptyString)
      .map((name) => ({ name })),
    isImmutable: true,
    tagName: metadata.releaseTag,
  };
}

export async function writeReleaseViewFixture(filePath, metadata) {
  await writeFile(filePath, `${JSON.stringify(createReleaseViewFixture(metadata), null, 2)}\n`, 'utf8');
}