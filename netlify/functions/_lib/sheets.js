const { googleFetch } = require('./google-auth');
const { APP_CONFIG } = require('./config');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

function range(name, a1) {
  return encodeURIComponent(`${name}!${a1}`);
}

async function getSheetValues(sheetName, a1 = 'A:Z') {
  const response = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range(sheetName, a1)}`
  );
  const data = await response.json();
  return data.values || [];
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => headers.reduce((acc, header, index) => {
      acc[header] = row[index] || '';
      return acc;
    }, {}));
}

async function appendExpenseRow(row) {
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range(APP_CONFIG.sheetNames.expenses, 'A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    }
  );
}

async function batchGetSheets(ranges) {
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const response = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${query}`
  );
  const data = await response.json();
  return data.valueRanges || [];
}

async function updateDashboardSheet(dashboard) {
  const values = [
    { range: `${APP_CONFIG.sheetNames.dashboard}!A1`, values: [[APP_CONFIG.appTitle + ' ダッシュボード']] },
    { range: `${APP_CONFIG.sheetNames.dashboard}!A2`, values: [[`最終更新: ${new Date().toLocaleString('ja-JP')}`]] },
    { range: `${APP_CONFIG.sheetNames.dashboard}!A5:B10`, values: [
      ['総予算', dashboard.totalBudget],
      ['累計支出額', dashboard.totalSpent],
      ['残予算', dashboard.totalRemaining],
      ['当月支出額', dashboard.currentMonthSpent],
      ['件数', dashboard.expenseCount],
      ['未確定件数', dashboard.unconfirmedCount],
    ]},
    { range: `${APP_CONFIG.sheetNames.dashboard}!D5:E${5 + Math.max(dashboard.categoryBreakdown.length, 1)}`, values: [
      ['費目', '累計支出額'],
      ...dashboard.categoryBreakdown.map((item) => [item.categoryName, item.amount]),
    ]},
    { range: `${APP_CONFIG.sheetNames.dashboard}!G5:K${5 + Math.max(dashboard.recentExpenses.length, 1)}`, values: [
      ['利用日', '申請者', '支払先', '費目', '金額'],
      ...dashboard.recentExpenses.map((item) => [item.useDate, item.applicantName, item.vendorName, item.categoryName, item.amount]),
    ]},
  ];

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: values,
      }),
    }
  );
}

module.exports = {
  getSheetValues,
  rowsToObjects,
  appendExpenseRow,
  batchGetSheets,
  updateDashboardSheet,
};

