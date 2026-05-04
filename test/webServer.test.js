import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCategories, parseMultipartBuffer } from '../src/web/server.js';

test('parses a simple multipart file upload', () => {
  const boundary = 'ab-bot-boundary';
  const body = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="sample.csv"',
    'Content-Type: text/csv',
    '',
    'Date,Description,Amount',
    '2026-01-01,Shop,-12.50',
    `--${boundary}--`,
    '',
  ].join('\r\n'));

  const form = parseMultipartBuffer(body, boundary);

  assert.equal(form.file.filename, 'sample.csv');
  assert.equal(form.file.contentType, 'text/csv');
  assert.match(form.file.text, /Shop/);
});

test('parses multipart text fields alongside files', () => {
  const boundary = 'ab-bot-boundary';
  const body = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="profile"',
    '',
    'commbank-no-header',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="sample.csv"',
    'Content-Type: text/csv',
    '',
    '2026-01-01,-12.50,Shop,100.00',
    `--${boundary}--`,
    '',
  ].join('\r\n'));

  const form = parseMultipartBuffer(body, boundary);

  assert.equal(form.profile.text, 'commbank-no-header');
  assert.equal(form.file.filename, 'sample.csv');
});

test('normalizes Actual category groups for the web UI', () => {
  const categories = normalizeCategories([
    {
      name: 'Everyday',
      categories: [
        { id: 'cat-food', name: 'Food' },
        { id: 'cat-fuel', name: 'Fuel', hidden: true },
      ],
    },
    { id: 'cat-income', name: 'Income', groupName: 'Income' },
  ]);

  assert.deepEqual(categories, [
    { id: 'cat-food', name: 'Food', group: 'Everyday', hidden: false },
    { id: 'cat-fuel', name: 'Fuel', group: 'Everyday', hidden: true },
    { id: 'cat-income', name: 'Income', group: 'Income', hidden: false },
  ]);
});
