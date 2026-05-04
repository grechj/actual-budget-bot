import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCategoryRules, normalizeMerchant, suggestCategories } from '../src/index.js';

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

test('suggests categories from local rules before history', () => {
  const rules = loadCategoryRules([
    {
      name: 'Example grocery rule',
      pattern: 'example store',
      category: { id: 'cat-rule', name: 'Groceries' },
      confidence: 0.9,
    },
  ]);

  const suggestions = suggestCategories([
    {
      description: 'Example Store AUS',
      amount: -42.3,
    },
  ], [
    {
      payee_name: 'Example Store AUS',
      category: 'cat-history',
      category_name: 'Shopping',
    },
  ], { rules });

  assert.equal(suggestions[0].suggestedCategory.name, 'Groceries');
  assert.equal(suggestions[0].confidence, 0.9);
  assert.match(suggestions[0].reason, /Matched local rule/);
});
