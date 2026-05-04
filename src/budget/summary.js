export function summarizeTransactions(transactions, options = {}) {
  const currency = options.currency || 'AUD';
  const groupLimit = options.groupLimit ?? 10;
  const rows = transactions.map((transaction) => normalizeActualTransaction(transaction, options));
  const totals = rows.reduce((acc, transaction) => {
    if (transaction.amount < 0) {
      acc.spending += Math.abs(transaction.amount);
    } else {
      acc.income += transaction.amount;
    }
    acc.net += transaction.amount;
    return acc;
  }, { income: 0, spending: 0, net: 0 });

  return {
    currency,
    transactionCount: rows.length,
    totals: roundTotals(totals),
    byCategory: limitGroups(summarizeBy(rows, (transaction) => transaction.categoryName || 'Uncategorised'), groupLimit),
    byPayee: limitGroups(summarizeBy(rows, (transaction) => transaction.payeeName || transaction.description || 'Unknown'), groupLimit),
  };
}

export function summarizeBudgetMonth(budgetMonth) {
  const categories = extractBudgetCategories(budgetMonth);

  return {
    month: budgetMonth?.month || budgetMonth?.date || null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      group: category.group || category.groupName || null,
      budgeted: centsToAmount(category.budgeted ?? 0),
      spent: centsToAmount(category.spent ?? 0),
      balance: centsToAmount(category.balance ?? category.available ?? 0),
    })),
  };
}

export function normalizeActualTransaction(transaction, options = {}) {
  const amountFormat = options.amountFormat || 'cents';

  return {
    id: transaction.id || null,
    date: transaction.date,
    amount: amountFormat === 'amount' ? Number(transaction.amount ?? 0) : centsToAmount(transaction.amount ?? 0),
    description: transaction.description || transaction.imported_payee || transaction.importedPayee || transaction.payee_name || transaction.notes || '',
    payeeName: transaction.payee_name || transaction.payeeName || transaction.imported_payee || transaction.importedPayee || null,
    categoryId: transaction.category || transaction.category_id || transaction.categoryId || null,
    categoryName: transaction.category_name || transaction.categoryName || null,
    accountId: transaction.account || transaction.account_id || transaction.accountId || null,
  };
}

function summarizeBy(transactions, keyFn) {
  const groups = new Map();

  for (const transaction of transactions) {
    const key = keyFn(transaction);
    const existing = groups.get(key) || { name: key, income: 0, spending: 0, net: 0, transactionCount: 0 };
    if (transaction.amount < 0) {
      existing.spending += Math.abs(transaction.amount);
    } else {
      existing.income += transaction.amount;
    }
    existing.net += transaction.amount;
    existing.transactionCount += 1;
    groups.set(key, existing);
  }

  return [...groups.values()]
    .map(roundTotals)
    .sort((a, b) => b.spending - a.spending);
}

function extractBudgetCategories(budgetMonth) {
  if (!budgetMonth) {
    return [];
  }

  if (Array.isArray(budgetMonth.categories)) {
    return budgetMonth.categories;
  }

  if (Array.isArray(budgetMonth.categoryGroups)) {
    return budgetMonth.categoryGroups.flatMap((group) => (group.categories || []).map((category) => ({
      ...category,
      group: group.name,
    })));
  }

  return [];
}

function roundTotals(totals) {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [
    key,
    typeof value === 'number' ? Math.round(value * 100) / 100 : value,
  ]));
}

function centsToAmount(value) {
  return Math.round(Number(value || 0)) / 100;
}

function limitGroups(groups, limit) {
  if (limit === null || limit === undefined) {
    return groups;
  }

  return groups.slice(0, Math.max(limit, 0));
}
