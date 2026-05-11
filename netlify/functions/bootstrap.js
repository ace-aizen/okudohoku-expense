const { APP_CONFIG, hasGoogleConfig } = require('./_lib/config');
const { ok, serverError } = require('./_lib/http');
const { hasAppsScriptConfig, callAppsScriptApi } = require('./_lib/apps-script-api');
const { batchGetSheets, rowsToObjects } = require('./_lib/sheets');
const { computeDashboard } = require('./_lib/expense');

exports.handler = async () => {
  try {
    if (hasAppsScriptConfig()) {
      return ok(await callAppsScriptApi('bootstrap'));
    }

    if (!hasGoogleConfig()) {
      return ok({
        ok: true,
        appTitle: APP_CONFIG.appTitle,
        defaultProjectName: APP_CONFIG.defaultProjectName,
        totalBudget: APP_CONFIG.totalBudget,
        applicants: APP_CONFIG.defaultApplicants,
        categories: APP_CONFIG.defaultCategories,
        rules: [],
        statusOptions: APP_CONFIG.statusOptions,
        dashboard: computeDashboard([], APP_CONFIG.defaultCategories),
        recentExpenses: [],
        debug: { applicantCount: 0, categoryCount: 0, ruleCount: 0, fallback: true },
      });
    }

    const ranges = [
      `${APP_CONFIG.sheetNames.config}!A:B`,
      `${APP_CONFIG.sheetNames.applicants}!A:E`,
      `${APP_CONFIG.sheetNames.categories}!A:D`,
      `${APP_CONFIG.sheetNames.rules}!A:F`,
      `${APP_CONFIG.sheetNames.expenses}!A:AC`,
    ];
    const [configRange, applicantsRange, categoriesRange, rulesRange, expensesRange] = await batchGetSheets(ranges);
    const configRows = rowsToObjects(configRange.values || []);
    const applicants = rowsToObjects(applicantsRange.values || []).filter((row) => String(row.active_flag || '').toUpperCase() !== 'FALSE');
    const categories = rowsToObjects(categoriesRange.values || []).filter((row) => String(row.active_flag || '').toUpperCase() !== 'FALSE');
    const rules = rowsToObjects(rulesRange.values || []).filter((row) => String(row.active_flag || '').toUpperCase() !== 'FALSE');
    const expenses = rowsToObjects(expensesRange.values || []);
    const configMap = configRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    const effectiveApplicants = applicants.length ? applicants : APP_CONFIG.defaultApplicants;
    const effectiveCategories = categories.length ? categories : APP_CONFIG.defaultCategories;
    const totalBudget = Number(configMap.total_budget || APP_CONFIG.totalBudget);
    const dashboard = computeDashboard(expenses, effectiveCategories, totalBudget);

    return ok({
      ok: true,
      appTitle: configMap.app_title || APP_CONFIG.appTitle,
      defaultProjectName: configMap.default_project_name || APP_CONFIG.defaultProjectName,
      totalBudget,
      applicants: effectiveApplicants,
      categories: effectiveCategories,
      rules,
      statusOptions: APP_CONFIG.statusOptions,
      dashboard,
      recentExpenses: dashboard.recentExpenses,
      debug: {
        applicantCount: applicants.length,
        categoryCount: categories.length,
        ruleCount: rules.length,
        fallback: false,
      },
    });
  } catch (error) {
    return serverError(error);
  }
};
