import { normalizeAmount, normalizeDate, normalizeDescription } from './normalize.js';
import { validateCanonicalTransaction } from './validate.js';

const DATE_PATTERN = String.raw`(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})`;
const AMOUNT_PATTERN = String.raw`(?:\(?-?\$?\d[\d,]*(?:\.\d{2})?\)?)`;
const DIRECTION_PATTERN = String.raw`(?:CR|DR|CREDIT|DEBIT|OUT|IN|WITHDRAWAL|DEPOSIT)`;

const OCR_LINE_PATTERNS = [
  {
    name: 'date-description-amount',
    regex: new RegExp(String.raw`^(?<date>${DATE_PATTERN})\s+(?<description>.+?)\s+(?<amount>${AMOUNT_PATTERN})(?:\s+(?<direction>${DIRECTION_PATTERN}))?$`, 'i'),
  },
  {
    name: 'description-date-amount',
    regex: new RegExp(String.raw`^(?<description>.+?)\s+(?<date>${DATE_PATTERN})\s+(?<amount>${AMOUNT_PATTERN})(?:\s+(?<direction>${DIRECTION_PATTERN}))?$`, 'i'),
  },
  {
    name: 'description-amount-date',
    regex: new RegExp(String.raw`^(?<description>.+?)\s+(?<amount>${AMOUNT_PATTERN})\s+(?<date>${DATE_PATTERN})(?:\s+(?<direction>${DIRECTION_PATTERN}))?$`, 'i'),
  },
];

export function createOcrTextPreview(text, options = {}) {
  const lines = String(text ?? '').split(/\r?\n/);
  const transactions = [];
  const issues = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const raw = line.trim();

    if (!raw) {
      return;
    }

    const parsed = parseOcrTransactionLine(raw, { lineNumber, defaultDirection: options.defaultDirection });

    if (!parsed.transaction) {
      issues.push({
        severity: 'warning',
        field: 'line',
        message: 'OCR line did not match a known transaction pattern.',
        lineNumber,
      });
      return;
    }

    transactions.push(parsed.transaction);
    issues.push(...parsed.issues);
  });

  return {
    transactions,
    issues,
    summary: {
      totalLines: lines.filter((line) => line.trim()).length,
      importedRows: transactions.length,
      issueCount: issues.length,
    },
  };
}

export function parseOcrTransactionLine(line, options = {}) {
  const match = matchOcrLine(line);

  if (!match) {
    return { transaction: null, issues: [] };
  }

  const direction = normalizeDirection(match.groups.direction, line, options.defaultDirection);
  const amount = applyDirection(normalizeAmount(match.groups.amount), direction);
  const confidence = scoreMatch(match.pattern, match.groups, direction);
  const transaction = {
    date: normalizeDate(match.groups.date),
    description: normalizeDescription(match.groups.description),
    amount,
    account: null,
    external_id: null,
    category: null,
    source: {
      type: 'ocr',
      lineNumber: options.lineNumber ?? null,
      confidence,
      parser: match.pattern,
    },
  };

  const issues = validateCanonicalTransaction(transaction).map((issue) => ({
    ...issue,
    lineNumber: options.lineNumber ?? null,
  }));

  if (!direction && amount > 0) {
    issues.push({
      severity: 'warning',
      field: 'amount',
      message: 'OCR amount has no debit/credit marker; review the sign before import.',
      lineNumber: options.lineNumber ?? null,
    });
  }

  if (confidence < 0.9) {
    issues.push({
      severity: 'warning',
      field: 'confidence',
      message: 'OCR transaction confidence is below the high-confidence threshold.',
      lineNumber: options.lineNumber ?? null,
    });
  }

  return { transaction, issues };
}

function matchOcrLine(line) {
  for (const pattern of OCR_LINE_PATTERNS) {
    const match = line.match(pattern.regex);

    if (match?.groups) {
      return { pattern: pattern.name, groups: match.groups };
    }
  }

  return null;
}

function normalizeDirection(direction, line, defaultDirection = null) {
  const normalized = String(direction ?? '').trim().toLowerCase();

  if (['cr', 'credit', 'in', 'deposit'].includes(normalized)) {
    return 'credit';
  }

  if (['dr', 'debit', 'out', 'withdrawal'].includes(normalized)) {
    return 'debit';
  }

  const fullLine = line.toLowerCase();
  if (/\b(cr|credit|deposit)\b/.test(fullLine)) {
    return 'credit';
  }

  if (/\b(dr|debit|withdrawal)\b/.test(fullLine)) {
    return 'debit';
  }

  if (['credit', 'debit'].includes(defaultDirection)) {
    return defaultDirection;
  }

  return null;
}

function applyDirection(amount, direction) {
  if (direction === 'debit') {
    return -Math.abs(amount);
  }

  if (direction === 'credit') {
    return Math.abs(amount);
  }

  return amount;
}

function scoreMatch(pattern, groups, direction) {
  let score = 0.7;

  if (pattern === 'date-description-amount') {
    score += 0.1;
  }

  if (groups.description?.trim().length >= 3) {
    score += 0.1;
  }

  if (direction) {
    score += 0.1;
  }

  return Number(Math.min(score, 1).toFixed(2));
}
