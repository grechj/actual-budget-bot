import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function extractTextWithTesseract(imageBuffer, options = {}) {
  const binary = options.binary || process.env.TESSERACT_BIN || 'tesseract';
  const language = options.language || process.env.TESSERACT_LANG || 'eng';
  const runner = options.runner || runTesseract;
  const tempDir = await mkdtemp(join(tmpdir(), 'ab-bot-ocr-'));
  const imagePath = join(tempDir, options.filename || 'upload-image');

  try {
    await writeFile(imagePath, imageBuffer);
    return await runner(binary, [imagePath, 'stdout', '-l', language, '--psm', String(options.pageSegMode || 6)]);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Tesseract is not installed or not on PATH. Install it with "brew install tesseract", then restart the AB Bot web server.');
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runTesseract(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Tesseract failed with exit code ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }

      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}
