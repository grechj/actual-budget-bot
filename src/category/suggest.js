export function suggestCategories(transactions, history = [], options = {}) {
  const maxSuggestions = options.limit ?? transactions.length;
  const index = buildHistoryIndex(history);
  const rules = options.rules || [];

  return transactions.slice(0, maxSuggestions).map((transaction) => {
    const key = normalizeMerchant(transaction.description || transaction.payee_name || transaction.imported_payee || '');
    const ruleMatch = findRuleMatch(transaction, key, rules);

    if (ruleMatch) {
      return {
        rowNumber: transaction.source?.rowNumber ?? null,
        description: transaction.description,
        amount: transaction.amount,
        suggestedCategory: ruleMatch.category,
        confidence: ruleMatch.confidence,
        reason: `Matched local rule "${ruleMatch.name}".`,
      };
    }

    const match = index.get(key);

    if (!match) {
      return {
        rowNumber: transaction.source?.rowNumber ?? null,
        description: transaction.description,
        amount: transaction.amount,
        suggestedCategory: null,
        confidence: 0,
        reason: 'No matching categorised transaction found in history.',
      };
    }

    return {
      rowNumber: transaction.source?.rowNumber ?? null,
      description: transaction.description,
      amount: transaction.amount,
      suggestedCategory: {
        id: match.categoryId,
        name: match.categoryName,
      },
      confidence: match.count >= 3 ? 0.9 : 0.75,
      reason: `Matched ${match.count} previous transaction${match.count === 1 ? '' : 's'} with the same normalised merchant.`,
    };
  });
}

export function loadCategoryRules(rules = []) {
  return rules.map((rule) => ({
    name: rule.name,
    pattern: rule.pattern,
    category: rule.category,
    confidence: rule.confidence ?? 0.8,
  }));
}

export function buildHistoryIndex(history) {
  const candidates = new Map();

  for (const transaction of history) {
    const categoryId = transaction.categoryId || transaction.category || transaction.category_id;
    const categoryName = transaction.categoryName || transaction.category_name;

    if (!categoryId && !categoryName) {
      continue;
    }

    const key = normalizeMerchant(transaction.description || transaction.payeeName || transaction.payee_name || transaction.imported_payee || '');
    if (!key) {
      continue;
    }

    const existing = candidates.get(key) || {
      categoryId,
      categoryName,
      count: 0,
    };

    existing.count += 1;
    candidates.set(key, existing);
  }

  return candidates;
}

export function normalizeMerchant(description) {
  return String(description || '')
    .toLowerCase()
    .replace(/card xx\d+/g, '')
    .replace(/value date:\s*\d{1,2}\/\d{1,2}\/\d{2,4}/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/[^a-z0-9*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findRuleMatch(transaction, normalizedMerchant, rules) {
  const raw = String(transaction.description || transaction.payee_name || transaction.imported_payee || '');

  for (const rule of rules) {
    const target = rule.match === 'raw' ? raw : normalizedMerchant;
    const pattern = String(rule.pattern || '').toLowerCase();

    if (pattern && target.toLowerCase().includes(pattern)) {
      return rule;
    }
  }

  return null;
}
