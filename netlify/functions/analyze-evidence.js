const { APP_CONFIG, hasGoogleConfig } = require('./_lib/config');
const { ok, badRequest, serverError, parseBody } = require('./_lib/http');
const { hasAppsScriptConfig, callAppsScriptApi } = require('./_lib/apps-script-api');
const { batchGetSheets, rowsToObjects } = require('./_lib/sheets');
const {
  detectVendorName,
  detectAmountFromText,
  detectDateFromText,
  suggestCategoryCode,
  buildSummaryText,
  buildMatchSummary,
} = require('./_lib/expense');
const { runDriveOcr } = require('./_lib/drive');

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    const file = body.file;
    if (!file || !file.data || !file.name || !file.mimeType) {
      return badRequest('ファイル情報が不足しています。');
    }

    if (hasAppsScriptConfig()) {
      return ok(await callAppsScriptApi('analyzeEvidence', { file }));
    }

    let rules = [];
    let categories = APP_CONFIG.defaultCategories;
    if (hasGoogleConfig()) {
      const [rulesRange, categoriesRange] = await batchGetSheets([
        `${APP_CONFIG.sheetNames.rules}!A:F`,
        `${APP_CONFIG.sheetNames.categories}!A:D`,
      ]);
      rules = rowsToObjects(rulesRange.values || []).filter((row) => String(row.active_flag || '').toUpperCase() !== 'FALSE');
      const sheetCategories = rowsToObjects(categoriesRange.values || []).filter((row) => String(row.active_flag || '').toUpperCase() !== 'FALSE');
      if (sheetCategories.length) categories = sheetCategories;
    }

    let extractedText = '';
    if (hasGoogleConfig()) {
      extractedText = await runDriveOcr({
        fileName: file.name,
        mimeType: file.mimeType,
        base64Data: file.data,
      });
    }

    const normalizedText = String(extractedText || '').replace(/\u3000/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    const vendorName = detectVendorName(normalizedText, file.name);
    const amount = detectAmountFromText(normalizedText);
    const useDate = detectDateFromText(normalizedText);
    const suggestedCategoryCode = suggestCategoryCode({
      vendorName,
      purposeText: '',
      fileName: file.name,
      ocrText: normalizedText,
    }, rules);
    const categoryMap = categories.reduce((acc, item) => ({ ...acc, [item.category_code]: item.category_name }), {});
    const suggestedCategoryName = categoryMap[suggestedCategoryCode] || '';

    return ok({
      ok: true,
      originalFileName: file.name,
      vendorName,
      amount,
      useDate,
      suggestedCategoryCode,
      suggestedCategoryName,
      extractedText,
      extractedTextExcerpt: normalizedText.slice(0, 500),
      extractionMethod: hasGoogleConfig() ? 'Drive OCR' : 'Filename heuristic',
      extractionStatus: normalizedText ? 'ok' : 'empty',
      summary: buildSummaryText(vendorName, suggestedCategoryName, useDate),
      matchSummary: buildMatchSummary(vendorName, amount, useDate, suggestedCategoryName),
    });
  } catch (error) {
    return serverError(error);
  }
};
