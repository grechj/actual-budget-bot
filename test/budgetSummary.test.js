import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTransactions } from '../src/index.js';

test('summarizes Actual transactions into income, spending, and grouped totals', () => {
  const summary = summarizeTransactions([
    {
      id: '1',
      date: '2026-05-01',
      amount: -4230,
      payee_name: 'Example Grocer',
      category_name: 'Groceries',
    },
    {
      id: '2',
      date: '2026-05-02',
      amount: 250000,
      payee_name: 'Example Employer',
      category_name: 'Income',
    },
  ]);

  assert.equal(summary.transactionCount, 2);
  assert.deepEqual(summary.totals, { income: 2500, spending: 42.3, net: 2457.7 });
  assert.equal(summary.byCategory[0].name, 'Groceries');
  assert.equal(summary.byCategory[0].spending, 42.3);
});
