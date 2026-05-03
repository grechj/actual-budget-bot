import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function getAbBotHome() {
  return process.env.AB_BOT_HOME || '.ab-bot';
}

export function getProfilesDir() {
  return join(getAbBotHome(), 'profiles');
}

export function getReviewsDir() {
  return join(getAbBotHome(), 'reviews');
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
  return path;
}
