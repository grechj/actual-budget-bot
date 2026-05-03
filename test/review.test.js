import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  approveAll,
  createCsvPreview,
  createReview,
  getApprovedTransactions,
  listMappingProfiles,
  loadReview,
  saveMappingProfile,
  saveReview,
  summarizeReview,
} from '../src/index.js';

test('creates, saves, loads, and approves a review file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ab-bot-review-'));
  const reviewPath = join(dir, 'review.json');

  try {
    const preview = createCsvPreview([
      'Date,Description,Amount',
      '2026-05-01,Coffee,-5.00',
      '2026-05-02,Lunch,-15.00',
    ].join('\n'));

    const review = createReview(preview, { id: 'review-test', sourceFile: '/tmp/bank.csv' });
    await saveReview(review, reviewPath);

    const loaded = await loadReview(reviewPath);
    assert.equal(loaded.transactions.length, 2);
    assert.equal(getApprovedTransactions(loaded).length, 0);

    const approved = approveAll(loaded);
    assert.equal(getApprovedTransactions(approved).length, 2);
    assert.equal(summarizeReview(approved, { limit: 1 }).summary.hiddenRows, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('saves and lists mapping profiles', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ab-bot-home-'));
  const originalHome = process.env.AB_BOT_HOME;
  process.env.AB_BOT_HOME = dir;

  try {
    await saveMappingProfile('test-bank', {
      version: 1,
      name: 'Test Bank',
      bank: 'Test Bank',
      delimiter: ',',
      hasHeader: false,
      mapping: {
        date: 'Column 1',
        amount: 'Column 2',
        description: 'Column 3',
      },
    });

    const profiles = await listMappingProfiles();
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].id, 'test-bank');
    assert.equal(profiles[0].hasHeader, false);
  } finally {
    if (originalHome === undefined) {
      delete process.env.AB_BOT_HOME;
    } else {
      process.env.AB_BOT_HOME = originalHome;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
