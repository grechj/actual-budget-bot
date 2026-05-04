import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextWithTesseract } from '../src/index.js';

test('extracts OCR text using an injectable Tesseract runner', async () => {
  const calls = [];
  const text = await extractTextWithTesseract(Buffer.from('image-bytes'), {
    filename: 'sample.png',
    runner: async (binary, args) => {
      calls.push({ binary, args });
      return '2026-01-03 Corner Store 12.50 DR';
    },
  });

  assert.equal(text, '2026-01-03 Corner Store 12.50 DR');
  assert.equal(calls[0].binary, 'tesseract');
  assert.equal(calls[0].args.at(1), 'stdout');
  assert.equal(calls[0].args.at(3), 'eng');
});

test('explains missing Tesseract binary clearly', async () => {
  await assert.rejects(
    extractTextWithTesseract(Buffer.from('image-bytes'), {
      runner: async () => {
        const error = new Error('missing binary');
        error.code = 'ENOENT';
        throw error;
      },
    }),
    /brew install tesseract/,
  );
});
