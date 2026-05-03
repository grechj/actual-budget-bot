import { createImportedId } from '../ingestion/dedupe.js';

export async function createActualBudgetClient(config, actualApi = null) {
  const api = actualApi ?? (await import('@actual-app/api'));

  return {
    async connect() {
      await api.init({
        dataDir: config.dataDir,
        serverURL: config.serverURL,
        password: config.password,
      });

      if (config.budgetId) {
        await api.downloadBudget(config.budgetId, config.budgetPassword ? { password: config.budgetPassword } : undefined);
      }
    },

    async shutdown() {
      await api.shutdown();
    },

    async getAccounts() {
      return api.getAccounts();
    },

    async getCategories() {
      return api.getCategories();
    },

    async getBudgetMonth(month) {
      return api.getBudgetMonth(month);
    },

    async getTransactions(accountId, startDate, endDate) {
      return api.getTransactions(accountId, startDate, endDate);
    },

    async importTransactions(accountId, transactions, options = {}) {
      const actualTransactions = transactions.map((transaction) => ({
        account: accountId,
        date: transaction.date,
        amount: api.utils.amountToInteger(transaction.amount),
        payee_name: transaction.description,
        imported_payee: transaction.description,
        imported_id: createImportedId(transaction),
        category: transaction.category ?? undefined,
      }));

      return api.importTransactions(accountId, actualTransactions, {
        defaultCleared: options.defaultCleared ?? true,
        dryRun: options.dryRun ?? false,
        reimportDeleted: options.reimportDeleted ?? false,
      });
    },
  };
}
