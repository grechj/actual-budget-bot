import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromImage, extractTextWithAppleVision, extractTextWithTesseract } from '../src/index.js';

test('extracts OCR text using an injectable Apple Vision runner', async () => {
  const calls = [];
  const text = await extractTextWithAppleVision(Buffer.from('image-bytes'), {
    filename: 'sample.png',
    appleVisionRunner: async (binary, args) => {
      calls.push({ binary, args });
      return '2026-01-03 Corner Store 12.50 DR';
    },
  });

  assert.equal(text, '2026-01-03 Corner Store 12.50 DR');
  assert.equal(calls[0].binary, '/usr/bin/swift');
  assert.match(calls[0].args[0], /ocr\.swift$/);
  assert.match(calls[0].args[1], /sample\.png$/);
});

test('falls back to Tesseract when Apple Vision fails', async () => {
  const text = await extractTextFromImage(Buffer.from('image-bytes'), {
    engines: ['apple-vision', 'tesseract'],
    appleVisionRunner: async () => {
      throw new Error('Vision unavailable');
    },
    tesseractRunner: async () => '2026-01-04 Payroll 1000.00 CR',
  });

  assert.equal(text, '2026-01-04 Payroll 1000.00 CR');
});

test('extracts OCR text using an injectable Tesseract runner', async () => {
  const calls = [];
  const text = await extractTextWithTesseract(Buffer.from('image-bytes'), {
    filename: 'sample.png',
    runner: async (binary, args) => {
      calls.push({ binary, args });
      return '2026-01-05 Book Shop 18.99 DR';
    },
  });

  assert.equal(text, '2026-01-05 Book Shop 18.99 DR');
  assert.equal(calls[0].binary, 'tesseract');
  assert.equal(calls[0].args.at(1), 'stdout');
  assert.equal(calls[0].args.at(3), 'eng');
});

test('explains missing local OCR engines clearly', async () => {
  await assert.rejects(
    extractTextFromImage(Buffer.from('image-bytes'), {
      engines: ['apple-vision', 'tesseract'],
      appleVisionRunner: async () => {
        const error = new Error('missing Swift');
        error.code = 'ENOENT';
        throw error;
      },
      tesseractRunner: async () => {
        const error = new Error('missing binary');
        error.code = 'ENOENT';
        throw error;
      },
    }),
    /No local OCR engine/,
  );
});
