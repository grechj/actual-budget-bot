#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  approveAll,
  createActualBudgetClient,
  createCsvPreview,
  createReview,
  formatCsvPreview,
  getApprovedTransactions,
  listMappingProfiles,
  loadActualConfig,
  loadMappingProfile,
  loadReview,
  resolveMappingProfile,
  saveMappingProfile,
  saveReview,
  summarizeReview,
  summarizeActualImportResult,
  withoutConsoleInfo,
} from './index.js';

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
} else if (command === 'profile:save') {
  const { name, profilePath } = parseProfileSaveArgs(args);
  const profile = await loadMappingProfile(profilePath);
  const savedPath = await saveMappingProfile(name, profile);
  console.log(JSON.stringify({ savedPath, profile: name }, null, 2));
} else if (command === 'profile:list') {
  console.log(JSON.stringify({ profiles: await listMappingProfiles() }, null, 2));
} else if (command === 'csv:review') {
  const { filePath, options, output } = await parseReviewArgs(args);
  if (!filePath) {
    exitWithUsage();
  }

  const text = await readFile(filePath, 'utf8');
  const preview = createCsvPreview(text, options);
  const review = createReview(preview, {
    sourceFile: filePath,
    profileName: output.profileName,
  });
  const reviewPath = await saveReview(review, output.out);
  console.log(JSON.stringify({ reviewPath, summary: summarizeReview(review, { limit: 0 }).summary }, null, 2));
} else if (command === 'review:summary') {
  const { reviewPath, limit } = parseReviewSummaryArgs(args);
  const review = await loadReview(reviewPath);
  console.log(JSON.stringify(summarizeReview(review, { limit }), null, 2));
} else if (command === 'review:approve-all') {
  const reviewPath = args[0];
  if (!reviewPath) {
    exitWithUsage();
  }

  const review = approveAll(await loadReview(reviewPath));
  await saveReview(review, reviewPath);
  console.log(JSON.stringify({ reviewPath, summary: summarizeReview(review, { limit: 0 }).summary }, null, 2));
} else if (command === 'actual:accounts') {
  await withActualClient(async (actual) => {
    console.log(JSON.stringify({ accounts: await actual.getAccounts() }, null, 2));
  });
} else if (command === 'actual:dry-run') {
  await importReviewToActual(args, { dryRun: true });
} else if (command === 'actual:commit') {
  await importReviewToActual(args, { dryRun: false });
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
    } else if (arg === '--profile') {
      const profileName = args[index + 1];
      if (!profileName) {
        throw new Error('--profile requires a saved profile name.');
      }

      const profile = await resolveMappingProfile(profileName);
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

async function parseReviewArgs(args) {
  const parsed = await parsePreviewArgs(args);
  parsed.output.out = null;
  parsed.output.profileName = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--out') {
      parsed.output.out = args[index + 1];
      index += 1;
    } else if (args[index] === '--profile') {
      parsed.output.profileName = args[index + 1];
      index += 1;
    } else if (args[index] === '--mapping') {
      parsed.output.profileName = args[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function parseProfileSaveArgs(args) {
  const name = args[0];
  let profilePath = null;

  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--mapping') {
      profilePath = args[index + 1];
      index += 1;
    }
  }

  if (!name || !profilePath) {
    exitWithUsage();
  }

  return { name, profilePath };
}

function parseReviewSummaryArgs(args) {
  const reviewPath = args[0];
  let limit = 10;

  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--limit') {
      limit = Number.parseInt(args[index + 1], 10);
      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error('--limit requires a non-negative number.');
      }
      index += 1;
    }
  }

  if (!reviewPath) {
    exitWithUsage();
  }

  return { reviewPath, limit };
}

async function importReviewToActual(args, options) {
  const { reviewPath, accountId, yes } = parseActualImportArgs(args);

  if (!options.dryRun && !yes) {
    throw new Error('actual:commit requires --yes so transaction writes are explicit.');
  }

  const review = await loadReview(reviewPath);
  const transactions = getApprovedTransactions(review);

  if (transactions.length === 0) {
    throw new Error('No approved transactions found. Run review:approve-all or edit the review file first.');
  }

  await withActualClient(async (actual) => {
    const result = await withoutConsoleInfo(() => actual.importTransactions(accountId, transactions, {
      dryRun: options.dryRun,
      defaultCleared: true,
      reimportDeleted: false,
    }));
    console.log(JSON.stringify({
      dryRun: options.dryRun,
      attemptedRows: transactions.length,
      result: summarizeActualImportResult(result),
    }, null, 2));
  });
}

function parseActualImportArgs(args) {
  const reviewPath = args[0];
  let accountId = null;
  let yes = false;

  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--account-id') {
      accountId = args[index + 1];
      index += 1;
    } else if (args[index] === '--yes') {
      yes = true;
    }
  }

  if (!reviewPath || !accountId) {
    exitWithUsage();
  }

  return { reviewPath, accountId, yes };
}

async function withActualClient(task) {
  const actual = await createActualBudgetClient(loadActualConfig());

  try {
    await actual.connect();
    await task(actual);
  } finally {
    await actual.shutdown();
  }
}

function exitWithUsage() {
  console.error(
    [
      'Usage:',
      '  ab-bot csv:preview <bank.csv> [--mapping profile.json|--profile name] [--summary] [--limit 10]',
      '  ab-bot profile:save <name> --mapping profile.json',
      '  ab-bot profile:list',
      '  ab-bot csv:review <bank.csv> [--mapping profile.json|--profile name] [--out review.json]',
      '  ab-bot review:summary <review.json> [--limit 10]',
      '  ab-bot review:approve-all <review.json>',
      '  ab-bot actual:accounts',
      '  ab-bot actual:dry-run <review.json> --account-id <actual-account-id>',
      '  ab-bot actual:commit <review.json> --account-id <actual-account-id> --yes',
    ].join('\n'),
  );
  process.exit(1);
}
