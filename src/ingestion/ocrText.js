import { normalizeAmount, normalizeDate, normalizeDescription } from './normalize.js';
import { validateCanonicalTransaction } from './validate.js';

const DATE_PATTERN = String.raw`(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})`;
const AMOUNT_PATTERN = String.raw`(?:\(?-?\$?\d[\d,]*(?:\.\d{2})?\)?)`;
const DIRECTION_PATTERN = String.raw`(?:CR|DR|CREDIT|DEBIT|OUT|IN|WITHDRAWAL|DEPOSIT)`;
const STANDALONE_AMOUNT_REGEX = /^-?\$?\d[\d,]*(?:\.\d{2})?$/;
const MOBILE_DATE_HEADER_REGEX = /^(?:mon|tue|wed|thu|fri|sat|sun)\s+(?<day>\d{1,2})\s+(?<month>[a-z]{3,9})\b/i;
const MONTHS = new Map([
  ['jan', '01'],
  ['january', '01'],
  ['feb', '02'],
  ['february', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['apr', '04'],
  ['april', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['aug', '08'],
  ['august', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['september', '09'],
  ['oct', '10'],
  ['october', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['dec', '12'],
  ['december', '12'],
]);
const CATEGORY_REGEX = /^(?:bills?|business|cash|education|entertainment|fees? & interest|food|grocer(?:y|ies)|health|home|income|insurance|shopping|shares|transfers? & payments|transport|travel|uncategorised|uncategorized|utilities)$/i;
const MOBILE_NOISE_REGEX = /^(?:\d{1,2}:\d{2}.*|[45]g|x|main|- ?\.{2,}|%|\d+|o=|n)$/i;

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
  const mobilePreview = createMobileBankingPreview(lines, options);

  if (mobilePreview.detected) {
    const { detected, ...preview } = mobilePreview;
    return preview;
  }

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

function createMobileBankingPreview(lines, options) {
  const cleanedLines = lines
    .map((line, index) => ({
      lineNumber: index + 1,
      text: normalizeDescription(line),
    }))
    .filter((line) => line.text);
  const transactions = [];
  const issues = [];
  let currentDate = null;
  let blockStart = 0;
  let index = 0;
  let detected = false;

  while (index < cleanedLines.length) {
    const line = cleanedLines[index];
    const date = parseMobileDateHeader(line.text, options.currentYear);

    if (date) {
      detected = true;
      issues.push(...createUnparsedMobileBlockIssues(cleanedLines.slice(blockStart, index)));
      currentDate = date;
      blockStart = index + 1;
      index += 1;
      continue;
    }

    if (currentDate && STANDALONE_AMOUNT_REGEX.test(line.text)) {
      const descriptionLines = cleanedLines
        .slice(blockStart, index)
        .map((candidate) => candidate.text)
        .filter((candidate) => isMobileDescriptionLine(candidate));
      const normalizedDescriptionLines = normalizeMobileDescriptionLines(descriptionLines);

      if (normalizedDescriptionLines.length > 0) {
        transactions.push(createMobileTransaction({
          date: currentDate,
          description: normalizedDescriptionLines.join(' '),
          amountText: line.text,
          lineNumber: line.lineNumber,
        }));
        index += 1;
        blockStart = index;

        if (cleanedLines[index] && CATEGORY_REGEX.test(cleanedLines[index].text)) {
          index += 1;
          blockStart = index;
        }

        continue;
      }
    }

    index += 1;
  }

  issues.push(...createUnparsedMobileBlockIssues(cleanedLines.slice(blockStart)));

  return {
    transactions,
    issues,
    detected,
    summary: {
      totalLines: cleanedLines.length,
      importedRows: transactions.length,
      issueCount: issues.length,
    },
  };
}

function createMobileTransaction({ date, description, amountText, lineNumber }) {
  const amount = normalizeAmount(amountText);

  return {
    date,
    description: normalizeDescription(description),
    amount,
    account: null,
    external_id: null,
    category: null,
    source: {
      type: 'ocr',
      lineNumber,
      confidence: 0.85,
      parser: 'mobile-banking-block',
    },
  };
}

function parseMobileDateHeader(line, currentYear = new Date().getFullYear()) {
  const match = line.match(MOBILE_DATE_HEADER_REGEX);

  if (!match?.groups) {
    return null;
  }

  const month = MONTHS.get(match.groups.month.toLowerCase());

  if (!month) {
    return null;
  }

  return `${currentYear}-${month}-${match.groups.day.padStart(2, '0')}`;
}

function isMobileDescriptionLine(line) {
  if (!line || STANDALONE_AMOUNT_REGEX.test(line)) {
    return false;
  }

  if (CATEGORY_REGEX.test(line) || MOBILE_DATE_HEADER_REGEX.test(line) || MOBILE_NOISE_REGEX.test(line)) {
    return false;
  }

  return true;
}

function normalizeMobileDescriptionLines(lines) {
  const pendingIndex = lines.findIndex((line) => /^pending:/i.test(line));

  if (pendingIndex > 0) {
    return lines.slice(pendingIndex);
  }

  return lines;
}

function createUnparsedMobileBlockIssues(lines) {
  const descriptionLines = normalizeMobileDescriptionLines(
    lines
      .map((line) => line.text)
      .filter((line) => isMobileDescriptionLine(line)),
  );

  if (descriptionLines.length === 0) {
    return [];
  }

  return [
    {
      severity: 'warning',
      field: 'amount',
      message: 'OCR found a possible transaction description without a matching amount.',
      lineNumber: lines[0]?.lineNumber ?? null,
    },
  ];
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
