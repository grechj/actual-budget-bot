import { readFile } from 'node:fs/promises';

export async function loadMappingProfile(filePath) {
  const text = await readFile(filePath, 'utf8');
  const profile = JSON.parse(text);

  if (!profile.mapping) {
    throw new Error('Mapping profile must include a mapping object.');
  }

  return profile;
}

export function createMappingProfile({ name, bank, mapping, delimiter = null }) {
  return {
    version: 1,
    name,
    bank,
    delimiter,
    hasHeader: true,
    mapping,
  };
}
