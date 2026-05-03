import { createHash } from 'node:crypto';
import { normalizeDescription } from './normalize.js';

export function createImportedId(transaction) {
  if (transaction.external_id) {
    return `external:${transaction.external_id}`;
  }

  const stable = [
    transaction.date,
    Number(transaction.amount).toFixed(2),
    normalizeDescription(transaction.description).toLowerCase(),
  ].join('|');

  return `ab-bot:${createHash('sha256').update(stable).digest('hex').slice(0, 24)}`;
}

export function findDuplicateCandidates(transactions) {
  const seen = new Map();
  const duplicates = [];

  for (const transaction of transactions) {
    const importedId = createImportedId(transaction);
    if (seen.has(importedId)) {
      duplicates.push({ importedId, first: seen.get(importedId), duplicate: transaction });
    } else {
      seen.set(importedId, transaction);
    }
  }

  return duplicates;
}
