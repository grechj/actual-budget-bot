import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportedId, findDuplicateCandidates, parseCsv } from '../src/index.js';

test('parses a simple bank CSV into canonical transactions', () => {
  const csv = [
    'Date,Description,Debit,Credit,Reference',
    '01/05/2026,WOOLWORTHS 1234,42.30,,abc',
    '02/05/2026,Salary,,2500.00,def',
  ].join('\n');

  const transactions = parseCsv(csv);

  assert.deepEqual(transactions.map(({ date, description, amount, external_id }) => ({ date, description, amount, external_id })), [
    { date: '2026-05-01', description: 'WOOLWORTHS 1234', amount: -42.3, external_id: 'abc' },
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
