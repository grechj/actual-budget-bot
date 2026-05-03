#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createCsvPreview, loadMappingProfile } from './index.js';

const [, , command, ...args] = process.argv;

if (command === 'csv:preview') {
  const { filePath, options } = await parsePreviewArgs(args);
  if (!filePath) {
    exitWithUsage();
  }

  const text = await readFile(filePath, 'utf8');
  const preview = createCsvPreview(text, options);

  console.log(JSON.stringify(preview, null, 2));
} else {
  exitWithUsage();
}

async function parsePreviewArgs(args) {
  const options = {};
  let filePath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--mapping') {
      const mappingPath = args[index + 1];
      if (!mappingPath) {
        throw new Error('--mapping requires a profile JSON path.');
      }

      const profile = await loadMappingProfile(mappingPath);
      options.mapping = profile.mapping;
      options.delimiter = profile.delimiter ?? undefined;
      options.hasHeader = profile.hasHeader ?? undefined;
      index += 1;
    } else if (arg === '--delimiter') {
      options.delimiter = args[index + 1];
      index += 1;
    } else if (arg === '--no-header') {
      options.hasHeader = false;
    } else if (!filePath) {
      filePath = arg;
    }
  }

  return { filePath, options };
}

function exitWithUsage() {
  console.error('Usage: ab-bot csv:preview <path-to-bank.csv> [--mapping profile.json] [--delimiter ,] [--no-header]');
  process.exit(1);
}
