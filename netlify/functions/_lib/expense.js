const { APP_CONFIG } = require('./config');

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  return Number(String(value).replace(/[^\d.-]/g, '') || 0);
}

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeDateString(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function createExpenseId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `EXP-${stamp}-${random}`;
}

function detectVendorName(text, originalFileName) {
  const haystack = `${text} ${originalFileName}`.toLowerCase();
  const candidates = [
    { pattern: /(^|[\s])(ana|全日本空輸)([\s]|$)/i, name: 'ANA' },
    { pattern: /(^|[\s])(jal|日本航空)([\s]|$)/i, name: 'JAL' },
    { pattern: /(airdo|エアドゥ|air do)/i, name: 'AIRDO' },
    { pattern: /(東横inn|東横イン|toyoko inn)/i, name: '東横INN' },
    { pattern: /(トヨタレンタカー|toyota rent a car)/i, name: 'トヨタレンタカー' },
    { pattern: /(ニッポンレンタカー|nippon rent-a-car)/i, name: 'ニッポンレンタカー' },
    { pattern: /(times car|タイムズカー)/i, name: 'Times Car' },
    { pattern: /(peatix)/i, name: 'Peatix' },
  ];
  const match = candidates.find((candidate) => candidate.pattern.test(haystack));
  return match ? match.name : '';
}

function detectAmountFromText(text) {
  const labeledPatterns = [
    /(?:合計|合計額|領収金額|お支払(?:額|金額)?|ご請求額|請求金額|ご利用額|金額)[^\d]{0,10}([0-9][0-9,]{2,})/gi,
    /(?:total|amount|charged)[^\d]{0,10}([0-9][0-9,]{2,})/gi,
  ];
  for (const pattern of labeledPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) return normalizeNumber(match[1]);
  }
  const matches = text.match(/[0-9][0-9,]{2,}/g) || [];
  const values = matches.map(normalizeNumber).filter((value) => value >= 500 && value <= 500000);
  return values.length ? Math.max(...values) : 0;
}

function detectDateFromText(text) {
  const patterns = [
    /(?:搭乗日|利用日|宿泊日|発行日|支払日|決済日)[^\d]{0,8}((?:20)?\d{2}[\/\-\.年]\d{1,2}[\/\-\.月]\d{1,2})/i,
    /((?:20)?\d{2}[\/\-\.年]\d{1,2}[\/\-\.月]\d{1,2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return normalizeDetectedDate(match[1]);
  }
  return '';
}

function normalizeDetectedDate(value) {
  const cleaned = String(value || '')
    .replace(/年/g, '/')
    .replace(/月/g, '/')
    .replace(/日/g, '')
    .replace(/[.\-]/g, '/');
  const match = cleaned.match(/(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return '';
  let year = Number(match[1]);
  if (year < 100) year += 2000;
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function suggestCategoryCode(input, rules) {
  const haystack = [input.vendorName || '', input.purposeText || '', input.fileName || '', input.ocrText || '']
    .join(' ')
    .toLowerCase();
  for (const rule of rules) {
    const matchType = String(rule.match_type || '').toLowerCase();
    const matchValue = String(rule.match_value || '').toLowerCase();
    if (!matchValue) continue;
    if (matchType === 'exact' && haystack === matchValue) return rule.category_code;
    if (matchType !== 'exact' && haystack.includes(matchValue)) return rule.category_code;
  }
  return '';
}

function buildSummaryText(vendorName, categoryName, useDate) {
  return [vendorName, categoryName, useDate].filter(Boolean).join(' / ');
}

function buildMatchSummary(vendorName, amount, useDate, categoryName) {
  return [
    vendorName ? `支払先: ${vendorName}` : '',
    categoryName ? `費目候補: ${categoryName}` : '',
    amount ? `金額: ${amount.toLocaleString('ja-JP')}` : '',
    useDate ? `利用日: ${useDate}` : '',
  ].filter(Boolean).join(' / ');
}

function determineEvidenceType(mimeType, fileName) {
  const lowerMime = String(mimeType || '').toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();
  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return 'PDF';
  if (lowerMime.includes('image')) return lowerName.includes('screenshot') ? 'スクショ' : '画像';
  return 'その他';
}

function computeDashboard(expenses, categories, totalBudget = APP_CONFIG.totalBudget) {
  const categoryMap = categories.reduce((acc, item) => {
    acc[item.category_code] = item.category_name;
    return acc;
  }, {});
  let totalSpent = 0;
  let currentMonthSpent = 0;
  let unconfirmedCount = 0;
  const categoryTotals = {};
  const today = new Date();
  const currentPrefix = today.toISOString().slice(0, 7);

  expenses.forEach((expense) => {
    const amount = normalizeNumber(expense.amount_final);
    if (!amount) return;
    totalSpent += amount;
    const categoryCode = expense.category_final || expense.category_rule || 'OTHER';
    categoryTotals[categoryCode] = (categoryTotals[categoryCode] || 0) + amount;
    if (!['確定', '集計反映済み'].includes(String(expense.review_status || ''))) {
      unconfirmedCount += 1;
    }
    if (String(expense.use_date || '').slice(0, 7) === currentPrefix) {
      currentMonthSpent += amount;
    }
  });

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([categoryCode, amount]) => ({
      categoryCode,
      categoryName: categoryMap[categoryCode] || categoryCode,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const recentExpenses = expenses
    .map((expense) => ({
      createdAt: expense.created_at || '',
      useDate: expense.use_date || '',
      applicantName: expense.applicant_name || '',
      vendorName: expense.vendor_name_final || expense.vendor_name_source || '',
      categoryName: categoryMap[expense.category_final || expense.category_rule] || expense.category_final || expense.category_rule || '未分類',
      amount: normalizeNumber(expense.amount_final),
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 10);

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    currentMonthSpent,
    expenseCount: expenses.length,
    unconfirmedCount,
    categoryBreakdown,
    recentExpenses,
  };
}

module.exports = {
  APP_CONFIG,
  normalizeNumber,
  safeText,
  normalizeDateString,
  createExpenseId,
  detectVendorName,
  detectAmountFromText,
  detectDateFromText,
  suggestCategoryCode,
  buildSummaryText,
  buildMatchSummary,
  determineEvidenceType,
  computeDashboard,
};
