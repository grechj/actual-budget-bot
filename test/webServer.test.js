import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMultipartBuffer } from '../src/web/server.js';

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
