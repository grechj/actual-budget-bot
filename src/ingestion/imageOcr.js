import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

const APPLE_VISION_SWIFT = `
import AppKit
import Foundation
import Vision

let imagePath = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: imagePath) else {
  fputs("Could not read image\\n", stderr)
  exit(2)
}

var rect = CGRect(origin: .zero, size: image.size)
guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
  fputs("Could not create CGImage\\n", stderr)
  exit(3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

let lines = (request.results ?? []).compactMap { observation in
  observation.topCandidates(1).first?.string
}

print(lines.joined(separator: "\\n"))
`;

export async function extractTextFromImage(imageBuffer, options = {}) {
  const engines = options.engines
    ? options.engines
    : options.engine
    ? [options.engine]
    : process.platform === 'darwin'
      ? ['apple-vision', 'tesseract']
      : ['tesseract'];
  const errors = [];

  for (const engine of engines) {
    try {
      if (engine === 'apple-vision') {
        return await extractTextWithAppleVision(imageBuffer, options);
      }

      if (engine === 'tesseract') {
        return await extractTextWithTesseract(imageBuffer, options);
      }
    } catch (error) {
      errors.push(`${engine}: ${error.message}`);
    }
  }

  throw new Error([
    'No local OCR engine could read this image.',
    ...errors,
    'On macOS, AB Bot can use Apple Vision via Swift. Otherwise install Tesseract with "brew install tesseract".',
  ].join(' '));
}

export async function extractTextWithAppleVision(imageBuffer, options = {}) {
  const binary = options.swiftBinary || process.env.SWIFT_BIN || '/usr/bin/swift';
  const runner = options.appleVisionRunner || runCommand;
  const tempDir = await mkdtemp(join(tmpdir(), 'ab-bot-vision-'));
  const imagePath = join(tempDir, safeFilename(options.filename || 'upload.png'));
  const scriptPath = join(tempDir, 'ocr.swift');

  try {
    await writeFile(imagePath, imageBuffer);
    await writeFile(scriptPath, APPLE_VISION_SWIFT);
    return await runner(binary, [scriptPath, imagePath]);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Apple Vision OCR needs Swift command-line tools. Install Xcode Command Line Tools or use Tesseract.');
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractTextWithTesseract(imageBuffer, options = {}) {
  const binary = options.binary || process.env.TESSERACT_BIN || 'tesseract';
  const language = options.language || process.env.TESSERACT_LANG || 'eng';
  const runner = options.tesseractRunner || options.runner || runCommand;
  const tempDir = await mkdtemp(join(tmpdir(), 'ab-bot-ocr-'));
  const imagePath = join(tempDir, safeFilename(options.filename || 'upload-image'));

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

function runCommand(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${basename(binary)} failed with exit code ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }

      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

function safeFilename(filename) {
  return basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload-image';
}
