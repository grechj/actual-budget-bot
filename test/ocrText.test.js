import test from 'node:test';
import assert from 'node:assert/strict';
import { createOcrTextPreview, parseOcrTransactionLine } from '../src/index.js';

test('parses OCR date description amount lines into canonical transactions', () => {
  const preview = createOcrTextPreview([
    '03/01/2026 Corner Store 12.50 DR',
    '04/01/2026 Salary 1000.00 CR',
  ].join('\n'));

  assert.equal(preview.summary.totalLines, 2);
  assert.equal(preview.summary.importedRows, 2);
  assert.equal(preview.transactions[0].date, '2026-01-03');
  assert.equal(preview.transactions[0].description, 'Corner Store');
  assert.equal(preview.transactions[0].amount, -12.5);
  assert.equal(preview.transactions[0].source.type, 'ocr');
  assert.equal(preview.transactions[1].amount, 1000);
});

test('supports exact regex matching when date appears after description', () => {
  const { transaction } = parseOcrTransactionLine('Book Shop 2026-01-05 $18.99 debit', { lineNumber: 7 });

  assert.equal(transaction.date, '2026-01-05');
  assert.equal(transaction.description, 'Book Shop');
  assert.equal(transaction.amount, -18.99);
  assert.equal(transaction.source.lineNumber, 7);
  assert.equal(transaction.source.parser, 'description-date-amount');
});

test('flags OCR lines that need review instead of guessing', () => {
  const preview = createOcrTextPreview([
    'Not a transaction line',
    '2026-01-06 Cafe 4.50',
  ].join('\n'));

  assert.equal(preview.summary.importedRows, 1);
  assert.equal(preview.summary.issueCount, 2);
  assert.equal(preview.issues[0].field, 'line');
  assert.equal(preview.issues[1].field, 'amount');
});

test('can apply a default OCR direction for bank screenshots', () => {
  const preview = createOcrTextPreview('2026-01-07 Groceries 45.67', { defaultDirection: 'debit' });

  assert.equal(preview.transactions[0].amount, -45.67);
  assert.equal(preview.transactions[0].source.confidence, 1);
});
