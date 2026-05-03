#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createCsvPreview, formatCsvPreview, loadMappingProfile } from './index.js';

const [, , command, ...args] = process.argv;

if (command === 'csv:preview') {
  const { filePath, options, output } = await parsePreviewArgs(args);
  if (!filePath) {
    exitWithUsage();
  }

  const text = await readFile(filePath, 'utf8');
  const preview = createCsvPreview(text, options);
  const formatted = formatCsvPreview(preview, output);

  console.log(JSON.stringify(formatted, null, 2));
} else {
  exitWithUsage();
}

async function parsePreviewArgs(args) {
  const options = {};
  const output = {};
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
    } else if (arg === '--summary') {
      output.summaryOnly = true;
    } else if (arg === '--limit') {
      const limit = Number.parseInt(args[index + 1], 10);
      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error('--limit requires a non-negative number.');
      }

      output.limit = limit;
      index += 1;
    } else if (!filePath) {
      filePath = arg;
    }
  }

  return { filePath, options, output };
}

function exitWithUsage() {
  console.error('Usage: ab-bot csv:preview <path-to-bank.csv> [--mapping profile.json] [--delimiter ,] [--no-header] [--summary] [--limit 10]');
  process.exit(1);
}
