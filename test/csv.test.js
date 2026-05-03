import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsvPreview, createImportedId, findDuplicateCandidates, formatCsvPreview, parseCsv } from '../src/index.js';

test('parses a simple bank CSV into canonical transactions', () => {
  const csv = [
    'Date,Description,Debit,Credit,Reference',
    '01/05/2026,Example Grocer,42.30,,abc',
    '02/05/2026,Salary,,2500.00,def',
  ].join('\n');

  const transactions = parseCsv(csv);

  assert.deepEqual(transactions.map(({ date, description, amount, external_id }) => ({ date, description, amount, external_id })), [
    { date: '2026-05-01', description: 'Example Grocer', amount: -42.3, external_id: 'abc' },
    { date: '2026-05-02', description: 'Salary', amount: 2500, external_id: 'def' },
  ]);
});

test('creates stable imported ids for duplicate detection', () => {
  const transaction = {
    date: '2026-05-01',
    description: ' Woolworths   1234 ',
    amount: -42.3,
  };

  assert.equal(createImportedId(transaction), createImportedId({ ...transaction, description: 'Woolworths 1234' }));
});

test('finds duplicate transactions in an import batch', () => {
  const transactions = [
    { date: '2026-05-01', description: 'Coffee', amount: -5 },
    { date: '2026-05-01', description: 'Coffee', amount: -5 },
  ];

  assert.equal(findDuplicateCandidates(transactions).length, 1);
});

test('creates a CSV preview with mapping, issues, duplicates, and summary', () => {
  const csv = [
    'Transaction Date,Merchant,Amount',
    '2026-05-01,Coffee,-5.00',
    '2026-05-01,Coffee,-5.00',
    '2026-05-02,Adjustment,0',
  ].join('\n');

  const preview = createCsvPreview(csv);

  assert.equal(preview.mapping.date, 'Transaction Date');
  assert.equal(preview.mapping.description, 'Merchant');
  assert.equal(preview.mapping.amount, 'Amount');
  assert.equal(preview.transactions.length, 3);
  assert.equal(preview.duplicates.length, 1);
  assert.equal(preview.summary.importedRows, 3);
  assert.ok(preview.issues.some((issue) => issue.severity === 'warning' && issue.field === 'amount'));
});

test('supports explicit mapping profiles for unusual bank headers', () => {
  const csv = [
    'When,Who,Out,In',
    '01/05/2026,Grocer,30.00,',
  ].join('\n');

  const preview = createCsvPreview(csv, {
    mapping: {
      date: 'When',
      description: 'Who',
      debit: 'Out',
      credit: 'In',
    },
  });

  assert.equal(preview.transactions[0].date, '2026-05-01');
  assert.equal(preview.transactions[0].description, 'Grocer');
  assert.equal(preview.transactions[0].amount, -30);
});

test('reports row errors without crashing the preview', () => {
  const csv = [
    'Date,Description,Amount',
    ',Coffee,-5.00',
  ].join('\n');

  const preview = createCsvPreview(csv);

  assert.equal(preview.transactions.length, 0);
  assert.equal(preview.issues[0].severity, 'error');
  assert.equal(preview.issues[0].rowNumber, 2);
});

test('supports CSV exports without a header row', () => {
  const csv = [
    '18/01/2026,"-14.00","Example Bike Shop","+7523.27"',
    '18/01/2026,"-103.00","Example Grocery Store","+7537.27"',
  ].join('\n');

  const preview = createCsvPreview(csv, {
    hasHeader: false,
    mapping: {
      date: 'Column 1',
      amount: 'Column 2',
      description: 'Column 3',
    },
  });

  assert.deepEqual(preview.header, ['Column 1', 'Column 2', 'Column 3', 'Column 4']);
  assert.equal(preview.transactions.length, 2);
  assert.equal(preview.transactions[0].date, '2026-01-18');
  assert.equal(preview.transactions[0].amount, -14);
  assert.equal(preview.transactions[0].description, 'Example Bike Shop');
});

test('formats a limited CSV preview for safer terminal output', () => {
  const csv = [
    'Date,Description,Amount',
    '2026-05-01,Coffee,-5.00',
    '2026-05-02,Lunch,-15.00',
    '2026-05-03,Book,-20.00',
  ].join('\n');

  const formatted = formatCsvPreview(createCsvPreview(csv), { limit: 2 });

  assert.equal(formatted.transactions.length, 2);
  assert.equal(formatted.summary.displayedRows, 2);
  assert.equal(formatted.summary.hiddenRows, 1);
});

test('formats a summary-only CSV preview', () => {
  const csv = [
    'Date,Description,Amount',
    '2026-05-01,Coffee,-5.00',
    '2026-05-01,Coffee,-5.00',
  ].join('\n');

  const formatted = formatCsvPreview(createCsvPreview(csv), { summaryOnly: true });

  assert.equal(formatted.transactions.length, 0);
  assert.equal(formatted.summary.displayedRows, 0);
  assert.equal(formatted.summary.hiddenRows, 2);
  assert.equal(formatted.duplicates[0].firstRowNumber, 2);
  assert.equal(formatted.duplicates[0].duplicateRowNumber, 3);
  assert.equal(formatted.duplicates[0].description, undefined);
});
