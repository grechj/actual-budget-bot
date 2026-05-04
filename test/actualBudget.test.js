import test from 'node:test';
import assert from 'node:assert/strict';
import { createActualBudgetClient, summarizeActualImportResult, withoutConsoleInfo } from '../src/index.js';

test('passes dry-run import options through to Actual Budget API', async () => {
  const calls = [];
  const mockApi = {
    utils: {
      amountToInteger: (amount) => Math.round(amount * 100),
    },
    init: async (config) => calls.push(['init', config]),
    downloadBudget: async (budgetId) => calls.push(['downloadBudget', budgetId]),
    shutdown: async () => calls.push(['shutdown']),
    importTransactions: async (accountId, transactions, options) => {
      calls.push(['importTransactions', accountId, transactions, options]);
      return { added: [], updated: [], errors: [] };
    },
  };

  const client = await createActualBudgetClient({
    dataDir: '.ab-bot/actual-data',
    serverURL: 'http://localhost:5006',
    password: 'password',
    budgetId: 'budget-id',
  }, mockApi);

  await client.connect();
  const result = await client.importTransactions('account-id', [
    {
      date: '2026-05-01',
      description: 'Example Grocer',
      amount: -42.3,
      category: null,
    },
  ], { dryRun: true });
  await client.shutdown();

  assert.deepEqual(result, { added: [], updated: [], errors: [] });

  const importCall = calls.find(([name]) => name === 'importTransactions');
  assert.equal(importCall[1], 'account-id');
  assert.equal(importCall[2][0].amount, -4230);
  assert.equal(importCall[2][0].payee_name, 'Example Grocer');
  assert.equal(importCall[3].dryRun, true);
  assert.equal(importCall[3].defaultCleared, true);
  assert.equal(importCall[3].reimportDeleted, false);
});

test('summarizes Actual import results without transaction details', () => {
  const result = summarizeActualImportResult({
    errors: [],
    added: ['transaction-id-1', 'transaction-id-2'],
    updated: ['transaction-id-3'],
    updatedPreview: [],
  });

  assert.deepEqual(result, {
    errors: [],
    addedCount: 2,
    updatedCount: 1,
    updatedPreviewCount: 0,
  });
});

test('can include Actual transaction IDs when requested', () => {
  const result = summarizeActualImportResult({
    errors: [],
    added: ['transaction-id-1'],
    updated: ['transaction-id-2'],
    updatedPreview: [],
  }, { includeIds: true });

  assert.deepEqual(result, {
    errors: [],
    addedCount: 1,
    updatedCount: 1,
    updatedPreviewCount: 0,
    added: ['transaction-id-1'],
    updated: ['transaction-id-2'],
    updatedPreview: [],
  });
});

test('can suppress noisy library console output during imports', async () => {
  let called = false;
  const originalLog = console.log;

  try {
    console.log = () => {
      called = true;
    };

    await withoutConsoleInfo(async () => {
      console.log('private import debug details');
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(called, false);
});
