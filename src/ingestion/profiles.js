import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, getProfilesDir } from '../storage/paths.js';

export async function loadMappingProfile(filePath) {
  const text = await readFile(filePath, 'utf8');
  const profile = JSON.parse(text);

  if (!profile.mapping) {
    throw new Error('Mapping profile must include a mapping object.');
  }

  return profile;
}

export async function resolveMappingProfile(nameOrPath) {
  if (nameOrPath.endsWith('.json') || nameOrPath.includes('/')) {
    return loadMappingProfile(nameOrPath);
  }

  return loadMappingProfile(join(getProfilesDir(), `${nameOrPath}.json`));
}

export async function saveMappingProfile(name, profile) {
  const profilesDir = await ensureDir(getProfilesDir());
  const targetPath = join(profilesDir, `${name}.json`);
  await writeFile(targetPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return targetPath;
}

export async function listMappingProfiles() {
  const profilesDir = await ensureDir(getProfilesDir());
  const entries = await readdir(profilesDir, { withFileTypes: true });
  const profiles = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const filePath = join(profilesDir, entry.name);
      const profile = await loadMappingProfile(filePath);
      profiles.push({
        id: entry.name.replace(/\.json$/, ''),
        path: filePath,
        name: profile.name || null,
        bank: profile.bank || null,
        hasHeader: profile.hasHeader ?? true,
      });
    }
  }

  return profiles;
}

export function createMappingProfile({ name, bank, mapping, delimiter = null, hasHeader = true }) {
  return {
    version: 1,
    name,
    bank,
    delimiter,
    hasHeader,
    mapping,
  };
}
