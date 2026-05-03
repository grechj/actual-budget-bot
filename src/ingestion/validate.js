export function validateCanonicalTransaction(transaction) {
  const issues = [];
  const rowNumber = transaction.source?.rowNumber ?? null;

  if (!transaction.date) {
    issues.push(createIssue('error', 'date', 'Transaction date is missing.', rowNumber));
  }

  if (!transaction.description) {
    issues.push(createIssue('error', 'description', 'Transaction description is missing.', rowNumber));
  }

  if (!Number.isFinite(transaction.amount)) {
    issues.push(createIssue('error', 'amount', 'Transaction amount is not a valid number.', rowNumber));
  }

  if (transaction.amount === 0) {
    issues.push(createIssue('warning', 'amount', 'Transaction amount is zero.', rowNumber));
  }

  return issues;
}

function createIssue(severity, field, message, rowNumber) {
  return { severity, field, message, rowNumber };
}
