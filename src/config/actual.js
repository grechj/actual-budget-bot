export function loadActualConfig(env = process.env) {
  return {
    dataDir: env.AB_BOT_DATA_DIR || '.ab-bot/actual-data',
    serverURL: env.ACTUAL_SERVER_URL || undefined,
    password: env.ACTUAL_PASSWORD || undefined,
    budgetId: env.ACTUAL_BUDGET_ID || undefined,
    budgetPassword: env.ACTUAL_BUDGET_PASSWORD || undefined,
  };
}
