#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseCsv, findDuplicateCandidates } from './index.js';

const [, , command, ...args] = process.argv;

if (command === 'csv:preview') {
  const filePath = args[0];
  if (!filePath) {
    exitWithUsage();
  }

  const text = await readFile(filePath, 'utf8');
  const transactions = parseCsv(text);
  const duplicates = findDuplicateCandidates(transactions);

  console.log(JSON.stringify({ transactions, duplicates }, null, 2));
} else {
  exitWithUsage();
}

function exitWithUsage() {
  console.error('Usage: ab-bot csv:preview <path-to-bank.csv>');
  process.exit(1);
}
