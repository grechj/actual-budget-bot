import { canonicalizeTransaction } from './normalize.js';

export function parseCsv(text, options = {}) {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const rows = parseDelimitedRows(text, delimiter);

  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;
  const mapping = normalizeMapping(options.mapping ?? inferMapping(header));

  return body
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row, index) => {
      const record = Object.fromEntries(header.map((name, columnIndex) => [name, row[columnIndex] ?? '']));
      return canonicalizeTransaction(record, mapping, { rowNumber: index + 2 });
    });
}

export function inferMapping(header) {
  const normalized = header.map((name) => [name, name.toLowerCase().replace(/[^a-z0-9]/g, '')]);
  const find = (...candidates) => normalized.find(([, value]) => candidates.includes(value))?.[0];

  return {
    date: find('date', 'transactiondate', 'posteddate', 'effectivedate'),
    description: find('description', 'details', 'narrative', 'payee', 'merchant'),
    amount: find('amount', 'transactionamount', 'value'),
    debit: find('debit', 'withdrawal', 'withdrawals', 'moneyout'),
    credit: find('credit', 'deposit', 'deposits', 'moneyin'),
    account: find('account', 'accountname'),
    externalId: find('id', 'transactionid', 'fitid', 'reference'),
  };
}

function normalizeMapping(mapping) {
  if (!mapping.date || !mapping.description || (!mapping.amount && !(mapping.debit || mapping.credit))) {
    throw new Error('CSV mapping must include date, description, and either amount or debit/credit columns.');
  }

  return mapping;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', ';', '\t'];
  return candidates
    .map((candidate) => [candidate, firstLine.split(candidate).length])
    .sort((a, b) => b[1] - a[1])[0][0];
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
