export function canonicalizeTransaction(record, mapping, metadata = {}) {
  const amount = mapping.amount
    ? normalizeAmount(record[mapping.amount])
    : normalizeDebitCredit(record[mapping.debit], record[mapping.credit]);

  return {
    date: normalizeDate(record[mapping.date]),
    description: normalizeDescription(record[mapping.description]),
    amount,
    account: mapping.account ? normalizeDescription(record[mapping.account]) : null,
    external_id: mapping.externalId ? normalizeDescription(record[mapping.externalId]) : null,
    category: null,
    source: {
      type: 'csv',
      rowNumber: metadata.rowNumber ?? null,
    },
  };
}

export function normalizeDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error('Transaction date is required.');
  }

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return formatDate(iso[1], iso[2], iso[3]);
  }

  const local = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (local) {
    const [, day, month, year] = local;
    return formatDate(year.length === 2 ? `20${year}` : year, month, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Unsupported transaction date: ${raw}`);
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeDescription(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 0;
  }

  const negative = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw.replace(/[,$()\s]/g, '');
  const amount = Number.parseFloat(cleaned);

  if (!Number.isFinite(amount)) {
    throw new Error(`Unsupported transaction amount: ${raw}`);
  }

  return negative ? -amount : amount;
}

function normalizeDebitCredit(debit, credit) {
  const debitAmount = normalizeAmount(debit);
  const creditAmount = normalizeAmount(credit);

  if (debitAmount && creditAmount) {
    throw new Error('Transaction cannot have both debit and credit amounts.');
  }

  return creditAmount || -Math.abs(debitAmount);
}

function formatDate(year, month, day) {
  return `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
