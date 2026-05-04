import { readFile, writeFile } from 'node:fs/promises';

export async function loadDotEnv(path = '.env', target = process.env) {
  let text = '';

  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }

  const values = parseEnvFile(text);

  for (const [key, value] of Object.entries(values)) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }

  return values;
}

export async function readEnvFile(path = '.env') {
  try {
    return parseEnvFile(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

export async function writeEnvFile(values, path = '.env') {
  await writeFile(path, formatEnvFile(values), 'utf8');
}

export function parseEnvFile(text) {
  const values = {};

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (!key) {
      continue;
    }

    values[key] = unquoteEnvValue(rawValue);
  }

  return values;
}

export function formatEnvFile(values) {
  const sections = [
    ['AB Bot local storage', ['AB_BOT_DATA_DIR']],
    ['Local web UI', ['AB_BOT_WEB_HOST', 'AB_BOT_WEB_PORT']],
    ['Actual Budget sync server', ['ACTUAL_SERVER_URL', 'ACTUAL_PASSWORD', 'ACTUAL_BUDGET_ID', 'ACTUAL_BUDGET_PASSWORD']],
    ['AI provider', ['AB_BOT_AI_PROVIDER', 'AB_BOT_AI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OLLAMA_BASE_URL', 'OLLAMA_MODEL']],
    ['OCR', ['SWIFT_BIN', 'TESSERACT_BIN', 'TESSERACT_LANG']],
  ];
  const lines = [];
  const written = new Set();

  for (const [title, keys] of sections) {
    lines.push(`# ${title}`);
    for (const key of keys) {
      lines.push(`${key}=${quoteEnvValue(values[key] ?? '')}`);
      written.add(key);
    }
    lines.push('');
  }

  for (const [key, value] of Object.entries(values)) {
    if (!written.has(key)) {
      lines.push(`${key}=${quoteEnvValue(value)}`);
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function unquoteEnvValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

function quoteEnvValue(value) {
  const text = String(value ?? '');

  if (!text || /^[A-Za-z0-9_./:@-]+$/.test(text)) {
    return text;
  }

  return JSON.stringify(text);
}
