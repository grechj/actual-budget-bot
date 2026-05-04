#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  approveAll,
  createActualBudgetClient,
  createCsvPreview,
  createOcrTextPreview,
  extractTextWithTesseract,
  createReview,
  buildBudgetContext,
  createAIProvider,
  formatCsvPreview,
  getApprovedTransactions,
  listMappingProfiles,
  loadActualConfig,
  loadAIConfig,
  loadCategoryRules,
  loadMappingProfile,
  loadReview,
  resolveMappingProfile,
  saveMappingProfile,
  saveReview,
  summarizeReview,
  summarizeActualImportResult,
  summarizeTransactions,
  suggestCategories,
  listAIProviders,
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
} else if (command === 'ocr:text-preview') {
  const { filePath, options } = parseOcrTextPreviewArgs(args);
  if (!filePath) {
    exitWithUsage();
  }

  const text = await readFile(filePath, 'utf8');
  console.log(JSON.stringify(createOcrTextPreview(text, options), null, 2));
} else if (command === 'ocr:image-preview') {
  const { filePath, options } = parseOcrTextPreviewArgs(args);
  if (!filePath) {
    exitWithUsage();
  }

  const text = await extractTextWithTesseract(await readFile(filePath), { filename: filePath });
  console.log(JSON.stringify({ ...createOcrTextPreview(text, options), rawText: text }, null, 2));
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
} else if (command === 'actual:summary') {
  const { accountId, startDate, endDate } = parseDateRangeAccountArgs(args);
  await withActualClient(async (actual) => {
    const transactions = await actual.getTransactions(accountId, startDate, endDate);
    console.log(JSON.stringify(summarizeTransactions(transactions), null, 2));
  });
} else if (command === 'category:suggest') {
  await suggestReviewCategories(args);
} else if (command === 'review:insights') {
  const { reviewPath, limit } = parseReviewSummaryArgs(args);
  const review = await loadReview(reviewPath);
  console.log(JSON.stringify({
    reviewPath,
    transactionSummary: summarizeTransactions(review.transactions, { amountFormat: 'amount', groupLimit: limit }),
    reviewSummary: summarizeReview(review, { limit }).summary,
  }, null, 2));
} else if (command === 'ai:ask') {
  await askAi(args);
} else if (command === 'ai:providers') {
  console.log(JSON.stringify({ providers: listAIProviders() }, null, 2));
} else if (command === 'ai:ollama-models') {
  await listOllamaModels(args);
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

function parseOcrTextPreviewArgs(args) {
  let filePath = null;
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--default-direction') {
      options.defaultDirection = args[index + 1];
      index += 1;
    } else if (!filePath) {
      filePath = args[index];
    }
  }

  return { filePath, options };
}

async function importReviewToActual(args, options) {
  const { reviewPath, accountId, yes, includeIds } = parseActualImportArgs(args);

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
      result: summarizeActualImportResult(result, { includeIds }),
    }, null, 2));
  });
}

function parseActualImportArgs(args) {
  const reviewPath = args[0];
  let accountId = null;
  let yes = false;
  let includeIds = false;

  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === '--account-id') {
      accountId = args[index + 1];
      index += 1;
    } else if (args[index] === '--yes') {
      yes = true;
    } else if (args[index] === '--ids') {
      includeIds = true;
    }
  }

  if (!reviewPath || !accountId) {
    exitWithUsage();
  }

  return { reviewPath, accountId, yes, includeIds };
}

function parseDateRangeAccountArgs(args) {
  let accountId = null;
  let startDate = null;
  let endDate = null;
  let question = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--account-id') {
      accountId = args[index + 1];
      index += 1;
    } else if (args[index] === '--start-date') {
      startDate = args[index + 1];
      index += 1;
    } else if (args[index] === '--end-date') {
      endDate = args[index + 1];
      index += 1;
    } else if (!question) {
      question = args[index];
    }
  }

  if (!accountId || !startDate || !endDate) {
    exitWithUsage();
  }

  return { accountId, startDate, endDate, question };
}

async function suggestReviewCategories(args) {
  const reviewPath = args[0];
  const { accountId, startDate, endDate, limit, rulesPath } = parseSuggestionArgs(args.slice(1));

  if (!reviewPath) {
    exitWithUsage();
  }

  const review = await loadReview(reviewPath);
  const rules = rulesPath ? loadCategoryRules(JSON.parse(await readFile(rulesPath, 'utf8'))) : [];

  if (!accountId) {
    console.log(JSON.stringify({
      reviewPath,
      suggestions: suggestCategories(review.transactions, [], { limit, rules }),
    }, null, 2));
    return;
  }

  await withActualClient(async (actual) => {
    const history = await actual.getTransactions(accountId, startDate, endDate);
    console.log(JSON.stringify({
      reviewPath,
      suggestions: suggestCategories(review.transactions, history, { limit, rules }),
    }, null, 2));
  });
}

function parseSuggestionArgs(args) {
  const parsed = parseOptionalDateRangeAccountArgs(args);
  let limit = 20;
  let rulesPath = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--limit') {
      limit = Number.parseInt(args[index + 1], 10);
      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error('--limit requires a non-negative number.');
      }
      index += 1;
    } else if (args[index] === '--rules') {
      rulesPath = args[index + 1];
      index += 1;
    }
  }

  return { ...parsed, limit, rulesPath };
}

function parseOptionalDateRangeAccountArgs(args) {
  let accountId = null;
  let startDate = null;
  let endDate = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--account-id') {
      accountId = args[index + 1];
      index += 1;
    } else if (args[index] === '--start-date') {
      startDate = args[index + 1];
      index += 1;
    } else if (args[index] === '--end-date') {
      endDate = args[index + 1];
      index += 1;
    }
  }

  if ((accountId || startDate || endDate) && (!accountId || !startDate || !endDate)) {
    throw new Error('--account-id, --start-date, and --end-date must be provided together.');
  }

  return { accountId, startDate, endDate };
}

async function askAi(args) {
  const { accountId, startDate, endDate, question, provider, model } = parseAiAskArgs(args);

  if (!question) {
    exitWithUsage();
  }

  await withActualClient(async (actual) => {
    const context = await buildBudgetContext(actual, { accountId, startDate, endDate });
    const aiProvider = createAIProvider(loadAIConfig(process.env, { provider, model }));
    const response = await aiProvider.generateResponse(question, context);
    console.log(JSON.stringify(response, null, 2));
  });
}

async function listOllamaModels(args) {
  const { baseUrl } = parseOllamaModelsArgs(args);
  const provider = createAIProvider(loadAIConfig(process.env, { provider: 'ollama', baseUrl }));
  const models = await provider.listModels();

  console.log(JSON.stringify({ provider: 'ollama', baseUrl: provider.baseUrl, models }, null, 2));
}

function parseOllamaModelsArgs(args) {
  let baseUrl = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--base-url') {
      baseUrl = args[index + 1];
      index += 1;
    }
  }

  return { baseUrl };
}

function parseAiAskArgs(args) {
  const parsed = parseDateRangeAccountArgs(args);
  let provider = null;
  let model = null;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--provider') {
      provider = args[index + 1];
      index += 1;
    } else if (args[index] === '--model') {
      model = args[index + 1];
      index += 1;
    }
  }

  return { ...parsed, provider, model };
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
      '  ab-bot ocr:text-preview <ocr-text.txt> [--default-direction debit|credit]',
      '  ab-bot ocr:image-preview <screenshot.png> [--default-direction debit|credit]',
      '  ab-bot csv:review <bank.csv> [--mapping profile.json|--profile name] [--out review.json]',
      '  ab-bot review:summary <review.json> [--limit 10]',
      '  ab-bot review:approve-all <review.json>',
      '  ab-bot actual:accounts',
      '  ab-bot actual:summary --account-id <actual-account-id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD',
      '  ab-bot review:insights <review.json> [--limit 10]',
      '  ab-bot category:suggest <review.json> [--rules rules.json] [--account-id <actual-account-id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD] [--limit 20]',
      '  ab-bot ai:providers',
      '  ab-bot ai:ollama-models [--base-url http://localhost:11434]',
      '  ab-bot ai:ask "question" --account-id <actual-account-id> --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--provider disabled|openai|ollama] [--model model]',
      '  ab-bot actual:dry-run <review.json> --account-id <actual-account-id> [--ids]',
      '  ab-bot actual:commit <review.json> --account-id <actual-account-id> --yes [--ids]',
    ].join('\n'),
  );
  process.exit(1);
}
