const APP_CONFIG = {
  appTitle: '奥道北 経費管理',
  defaultProjectName: process.env.APP_PROJECT_NAME || '奥道北プロジェクト',
  totalBudget: Number(process.env.APP_TOTAL_BUDGET || 5400000),
  sheetNames: {
    config: process.env.SHEET_NAME_CONFIG || '設定',
    applicants: process.env.SHEET_NAME_APPLICANTS || '申請者',
    categories: process.env.SHEET_NAME_CATEGORIES || '費目',
    rules: process.env.SHEET_NAME_RULES || '判定ルール',
    expenses: process.env.SHEET_NAME_EXPENSES || '経費台帳',
    dashboard: process.env.SHEET_NAME_DASHBOARD || 'ダッシュボード',
  },
  statusOptions: ['下書き', '一次判定済み', '要確認', '確定', '集計反映済み'],
  defaultApplicants: [
    { applicant_id: 'ITO', applicant_name: '伊東', applicant_email: '', active_flag: 'TRUE', sort_order: 1 },
    { applicant_id: 'SAKASHITA', applicant_name: '坂下', applicant_email: '', active_flag: 'TRUE', sort_order: 2 },
  ],
  defaultCategories: [
    { category_code: 'AIR', category_name: '航空券', sort_order: 1, active_flag: 'TRUE' },
    { category_code: 'TRANSPORT', category_name: '交通費', sort_order: 2, active_flag: 'TRUE' },
    { category_code: 'HOTEL', category_name: '宿泊費', sort_order: 3, active_flag: 'TRUE' },
    { category_code: 'CAR', category_name: '車両費', sort_order: 4, active_flag: 'TRUE' },
    { category_code: 'STAY', category_name: '滞在費', sort_order: 5, active_flag: 'TRUE' },
    { category_code: 'MEAL', category_name: '会食費', sort_order: 6, active_flag: 'TRUE' },
    { category_code: 'ENTERTAINMENT', category_name: '接待費', sort_order: 7, active_flag: 'TRUE' },
    { category_code: 'EVENT', category_name: 'イベント参加費', sort_order: 8, active_flag: 'TRUE' },
    { category_code: 'OTHER', category_name: 'その他', sort_order: 9, active_flag: 'TRUE' },
  ],
};

function hasGoogleConfig() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    process.env.GOOGLE_SPREADSHEET_ID &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

module.exports = {
  APP_CONFIG,
  hasGoogleConfig,
};

