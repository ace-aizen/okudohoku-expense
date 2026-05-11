const { APP_CONFIG, hasGoogleConfig } = require('./_lib/config');
const { ok, serverError } = require('./_lib/http');
const { hasAppsScriptConfig, callAppsScriptApi } = require('./_lib/apps-script-api');
const { batchGetSheets, rowsToObjects, updateDashboardSheet } = require('./_lib/sheets');
const { computeDashboard } = require('./_lib/expense');

exports.handler = async () => {
  try {
    if (hasAppsScriptConfig()) {
      return ok(await callAppsScriptApi('refreshDashboard'));
    }

    if (!hasGoogleConfig()) {
      const dashboard = computeDashboard([], APP_CONFIG.defaultCategories);
      return ok({ ok: true, dashboard, recentExpenses: dashboard.recentExpenses });
    }

    const [configRange, categoriesRange, expensesRange] = await batchGetSheets([
      `${APP_CONFIG.sheetNames.config}!A:B`,
      `${APP_CONFIG.sheetNames.categories}!A:D`,
      `${APP_CONFIG.sheetNames.expenses}!A:AC`,
    ]);
    const configRows = rowsToObjects(configRange.values || []);
    const configMap = configRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    const categories = rowsToObjects(categoriesRange.values || []);
    const expenses = rowsToObjects(expensesRange.values || []);
    const dashboard = computeDashboard(
      expenses,
      categories.length ? categories : APP_CONFIG.defaultCategories,
      Number(configMap.total_budget || APP_CONFIG.totalBudget)
    );
    await updateDashboardSheet(dashboard);
    return ok({ ok: true, dashboard, recentExpenses: dashboard.recentExpenses });
  } catch (error) {
    return serverError(error);
  }
};
