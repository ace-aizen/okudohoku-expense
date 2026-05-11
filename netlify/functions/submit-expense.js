const { APP_CONFIG, hasGoogleConfig } = require('./_lib/config');
const { ok, badRequest, serverError, parseBody } = require('./_lib/http');
const { hasAppsScriptConfig, callAppsScriptApi } = require('./_lib/apps-script-api');
const { batchGetSheets, rowsToObjects, appendExpenseRow, updateDashboardSheet } = require('./_lib/sheets');
const { saveOriginalEvidence } = require('./_lib/drive');
const {
  createExpenseId,
  normalizeDateString,
  normalizeNumber,
  safeText,
  suggestCategoryCode,
  determineEvidenceType,
  computeDashboard,
} = require('./_lib/expense');

exports.handler = async (event) => {
  try {
    if (hasAppsScriptConfig()) {
      const body = parseBody(event);
      return ok(await callAppsScriptApi('submitExpense', { payload: body }));
    }

    if (!hasGoogleConfig()) {
      return badRequest('Google 連携の環境変数が未設定です。Netlify の Environment variables を設定してください。');
    }

    const body = parseBody(event);
    const file = body.file;
    if (!body.applicantId || !file || !file.data || !file.mimeType || !file.name) {
      return badRequest('申請者または証憑ファイルが不足しています。');
    }

    const [configRange, applicantsRange, categoriesRange, rulesRange, expensesRange] = await batchGetSheets([
      `${APP_CONFIG.sheetNames.config}!A:B`,
      `${APP_CONFIG.sheetNames.applicants}!A:E`,
      `${APP_CONFIG.sheetNames.categories}!A:D`,
      `${APP_CONFIG.sheetNames.rules}!A:F`,
      `${APP_CONFIG.sheetNames.expenses}!A:AC`,
    ]);
    const configRows = rowsToObjects(configRange.values || []);
    const configMap = configRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    const applicants = rowsToObjects(applicantsRange.values || []);
    const categories = rowsToObjects(categoriesRange.values || []);
    const rules = rowsToObjects(rulesRange.values || []);
    const existingExpenses = rowsToObjects(expensesRange.values || []);
    const applicant = applicants.find((row) => String(row.applicant_id) === String(body.applicantId));
    if (!applicant) {
      return badRequest('申請者が見つかりません。');
    }

    const analysis = body.analysis || {};
    const expenseId = createExpenseId();
    const useDate = normalizeDateString(body.useDate || analysis.useDate);
    const amountSource = normalizeNumber(body.amountSource || analysis.amount);
    const amountManual = normalizeNumber(body.amountManual);
    const vendorSource = safeText(body.vendorNameSource) || safeText(analysis.vendorName);
    const vendorManual = safeText(body.vendorNameManual);
    const vendorFinal = vendorManual || vendorSource;
    const categoryRule = analysis.suggestedCategoryCode || suggestCategoryCode({
      vendorName: vendorSource,
      purposeText: body.purposeText || '',
      fileName: file.name,
      ocrText: analysis.extractedText || '',
    }, rules);
    const categoryManual = safeText(body.categoryManual);
    const categoryFinal = categoryManual || categoryRule;
    const amountFinal = amountManual || amountSource;

    if (!useDate) return badRequest('利用日を読み取れませんでした。利用日を入力してください。');
    if (!amountFinal) return badRequest('金額を読み取れませんでした。金額を入力してください。');

    const savedFile = await saveOriginalEvidence({
      expenseId,
      originalFileName: file.name,
      mimeType: file.mimeType,
      base64Data: file.data,
      useDate,
    });

    const row = [
      expenseId,
      new Date().toISOString(),
      applicant.applicant_id,
      applicant.applicant_name,
      useDate,
      vendorSource,
      vendorManual,
      vendorFinal,
      amountSource,
      amountManual,
      amountFinal,
      categoryRule,
      categoryManual,
      categoryFinal,
      safeText(body.purposeText) || safeText(analysis.summary),
      safeText(body.projectName) || configMap.default_project_name || APP_CONFIG.defaultProjectName,
      safeText(body.attendeesText),
      safeText(body.noteText),
      determineEvidenceType(file.mimeType, file.name),
      savedFile.name,
      file.name,
      safeText(analysis.extractedTextExcerpt),
      safeText(analysis.extractionMethod),
      safeText(analysis.matchSummary),
      savedFile.id,
      savedFile.webViewLink || savedFile.webContentLink || '',
      safeText(body.reviewStatus) || '一次判定済み',
      categoryFinal ? 'FALSE' : 'TRUE',
      categoryFinal ? '' : '費目未確定',
    ];

    await appendExpenseRow(row);
    const expensesAfter = existingExpenses.concat([rowsToObjects([expensesRange.values?.[0] || [], row])[0]]);
    const dashboard = computeDashboard(
      expensesAfter,
      categories.length ? categories : APP_CONFIG.defaultCategories,
      Number(configMap.total_budget || APP_CONFIG.totalBudget)
    );
    await updateDashboardSheet(dashboard);

    return ok({
      ok: true,
      expenseId,
      dashboard,
      recentExpenses: dashboard.recentExpenses,
    });
  } catch (error) {
    return serverError(error);
  }
};
