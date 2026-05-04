#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBudgetContext,
  createActualBudgetClient,
  createAIProvider,
  createCsvPreview,
  createOcrTextPreview,
  extractTextFromImage,
  listAIProviders,
  loadActualConfig,
  loadAIConfig,
  summarizeActualImportResult,
  withoutConsoleInfo,
} from '../index.js';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const staticDir = join(dirname, 'static');
const defaultPort = Number.parseInt(process.env.AB_BOT_WEB_PORT || '3000', 10);
const defaultHost = process.env.AB_BOT_WEB_HOST || '127.0.0.1';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createWebServer();
  server.listen(defaultPort, defaultHost, () => {
    console.log(`AB Bot web UI listening on http://${defaultHost}:${defaultPort}`);
  });
}

export function createWebServer(options = {}) {
  return createServer(async (request, response) => {
    try {
      await routeRequest(request, response, options);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message,
      });
    }
  });
}

async function routeRequest(request, response, options) {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/') {
    await sendStatic(response, 'index.html');
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
    await sendStatic(response, url.pathname.replace('/assets/', ''));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/providers') {
    sendJson(response, 200, { providers: listAIProviders() });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/accounts') {
    await withActualClient(async (actual) => {
      sendJson(response, 200, { accounts: await actual.getAccounts() });
    }, options);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/csv-preview') {
    const form = await parseMultipartForm(request);
    const file = requireFormFile(form, 'file');
    const preview = createCsvPreview(file.text);
    sendJson(response, 200, preview);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/ocr-preview') {
    const form = await parseMultipartForm(request);
    const file = requireFormFile(form, 'file');

    if (file.contentType?.startsWith('image/')) {
      const text = await extractTextFromImage(file.buffer, { filename: file.filename });
      const preview = createOcrTextPreview(text);
      sendJson(response, 200, {
        ...preview,
        rawText: text,
      });
      return;
    }

    sendJson(response, 200, createOcrTextPreview(file.text));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readJsonBody(request);
    await withActualClient(async (actual) => {
      const context = await buildBudgetContext(actual, {
        accountId: body.accountId,
        startDate: body.startDate,
        endDate: body.endDate,
      });
      const provider = createAIProvider(loadAIConfig(process.env, {
        provider: body.provider,
        model: body.model,
      }));
      const aiResponse = await provider.generateResponse(body.question, context);
      sendJson(response, 200, aiResponse);
    }, options);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/import') {
    const body = await readJsonBody(request);
    const transactions = body.transactions ?? [];

    if (!body.accountId) {
      sendJson(response, 400, { error: 'Choose an Actual Budget account before importing.' });
      return;
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      sendJson(response, 400, { error: 'No preview transactions are available to import.' });
      return;
    }

    if (!body.dryRun && body.confirm !== true) {
      sendJson(response, 400, { error: 'Commit imports require explicit confirmation.' });
      return;
    }

    await withActualClient(async (actual) => {
      const result = await withoutConsoleInfo(() => actual.importTransactions(body.accountId, transactions, {
        dryRun: body.dryRun !== false,
        defaultCleared: true,
        reimportDeleted: false,
      }));
      sendJson(response, 200, {
        dryRun: body.dryRun !== false,
        attemptedRows: transactions.length,
        result: summarizeActualImportResult(result),
      });
    }, options);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

async function withActualClient(task, options = {}) {
  const actual = options.actualClient || await createActualBudgetClient(loadActualConfig());

  try {
    if (!options.actualClient) {
      await actual.connect();
    }
    await task(actual);
  } finally {
    if (!options.actualClient) {
      await actual.shutdown();
    }
  }
}

async function sendStatic(response, fileName) {
  if (fileName.includes('..') || fileName.includes('/')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const filePath = join(staticDir, fileName);
  const content = await readFile(filePath);
  response.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
  response.end(content);
}

function contentTypeFor(filePath) {
  if (extname(filePath) === '.css') {
    return 'text/css; charset=utf-8';
  }

  if (extname(filePath) === '.js') {
    return 'text/javascript; charset=utf-8';
  }

  return 'text/html; charset=utf-8';
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(request) {
  const text = await readRequestText(request);
  return text ? JSON.parse(text) : {};
}

async function readRequestText(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function parseMultipartForm(request) {
  const contentType = request.headers['content-type'] || '';
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];

  if (!boundary) {
    throw new Error('Expected multipart form data.');
  }

  const body = await readRequestBuffer(request);
  return parseMultipartBuffer(body, boundary);
}

export function parseMultipartBuffer(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = body.indexOf(delimiter);

  while (cursor !== -1) {
    const next = body.indexOf(delimiter, cursor + delimiter.length);

    if (next === -1) {
      break;
    }

    const part = body.subarray(cursor + delimiter.length, next);
    cursor = next;

    if (part.subarray(0, 2).equals(Buffer.from('--'))) {
      continue;
    }

    const trimmed = trimPart(part);
    if (trimmed.length) {
      parts.push(parsePart(trimmed));
    }
  }

  return Object.fromEntries(parts.filter(Boolean).map((part) => [part.name, part]));
}

async function readRequestBuffer(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function trimPart(part) {
  let start = 0;
  let end = part.length;

  if (part[start] === 13 && part[start + 1] === 10) {
    start += 2;
  }

  if (part[end - 2] === 13 && part[end - 1] === 10) {
    end -= 2;
  }

  return part.subarray(start, end);
}

function parsePart(part) {
  const separator = part.indexOf(Buffer.from('\r\n\r\n'));

  if (separator === -1) {
    return null;
  }

  const headerText = part.subarray(0, separator).toString('utf8');
  const content = part.subarray(separator + 4);
  const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
  const name = disposition.match(/name="([^"]+)"/)?.[1];

  if (!name) {
    return null;
  }

  return {
    name,
    filename: disposition.match(/filename="([^"]*)"/)?.[1] || null,
    contentType: headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1] || null,
    buffer: content,
    text: content.toString('utf8'),
  };
}

function requireFormFile(form, name) {
  const file = form[name];

  if (!file?.filename) {
    throw new Error(`Upload a file in the "${name}" field.`);
  }

  return file;
}
