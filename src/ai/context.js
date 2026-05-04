import { summarizeTransactions } from '../budget/summary.js';

export async function buildBudgetContext(actualClient, options) {
  const transactions = await actualClient.getTransactions(options.accountId, options.startDate, options.endDate);
  const accounts = await actualClient.getAccounts();
  const categories = await actualClient.getCategories();

  return {
    accountId: options.accountId,
    dateRange: {
      startDate: options.startDate,
      endDate: options.endDate,
    },
    accounts,
    categories,
    transactionSummary: summarizeTransactions(transactions),
  };
}
