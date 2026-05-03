export function formatCsvPreview(preview, options = {}) {
  const limit = options.limit ?? null;
  const summaryOnly = options.summaryOnly ?? false;
  const transactions = summaryOnly ? [] : limitTransactions(preview.transactions, limit);

  return {
    summary: {
      ...preview.summary,
      displayedRows: transactions.length,
      hiddenRows: Math.max(preview.transactions.length - transactions.length, 0),
    },
    mapping: preview.mapping,
    issues: preview.issues,
    duplicates: preview.duplicates.map((duplicate) => formatDuplicate(duplicate, { summaryOnly })),
    transactions,
  };
}

function limitTransactions(transactions, limit) {
  if (limit === null || limit === undefined) {
    return transactions;
  }

  return transactions.slice(0, Math.max(limit, 0));
}

function formatDuplicate(duplicate, options = {}) {
  const formatted = {
    importedId: duplicate.importedId,
    firstRowNumber: duplicate.first.source?.rowNumber ?? null,
    duplicateRowNumber: duplicate.duplicate.source?.rowNumber ?? null,
  };

  if (!options.summaryOnly) {
    formatted.date = duplicate.duplicate.date;
    formatted.amount = duplicate.duplicate.amount;
    formatted.description = duplicate.duplicate.description;
  }

  return formatted;
}
