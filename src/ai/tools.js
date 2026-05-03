export function createBudgetTools(actualClient) {
  return {
    async get_transactions({ accountId, startDate, endDate }) {
      return actualClient.getTransactions(accountId, startDate, endDate);
    },

    async get_categories() {
      return actualClient.getCategories();
    },

    async get_accounts() {
      return actualClient.getAccounts();
    },

    async get_budget_status({ month }) {
      if (!actualClient.getBudgetMonth) {
        throw new Error('Budget month access is not available on this Actual client.');
      }

      return actualClient.getBudgetMonth(month);
    },
  };
}
