import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMerchant, suggestCategories } from '../src/index.js';

test('normalizes noisy bank descriptions for matching', () => {
  assert.equal(
    normalizeMerchant('EXAMPLE STORE AUS Card xx1234 Value Date: 01/05/2026'),
    'example store aus',
  );
});

test('suggests categories from matching historical transactions', () => {
  const suggestions = suggestCategories([
    {
      description: 'Example Store AUS Card xx1234 Value Date: 01/05/2026',
      amount: -42.3,
      source: { rowNumber: 2 },
    },
  ], [
    {
      payee_name: 'Example Store AUS',
      category: 'cat-groceries',
      category_name: 'Groceries',
    },
    {
      payee_name: 'Example Store AUS',
      category: 'cat-groceries',
      category_name: 'Groceries',
    },
  ]);

  assert.equal(suggestions[0].rowNumber, 2);
  assert.equal(suggestions[0].suggestedCategory.name, 'Groceries');
  assert.equal(suggestions[0].confidence, 0.75);
});
