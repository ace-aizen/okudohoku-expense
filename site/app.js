const state = {
  bootstrap: null,
  selectedFile: null,
  selectedFileData: null,
  analysis: null,
  toastTimer: null,
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadBootstrap();
});

function bindEvents() {
  document.getElementById('expense-form').addEventListener('submit', onSubmit);
  document.getElementById('refresh-button').addEventListener('click', refreshDashboard);
  document.getElementById('select-file-button').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) setSelectedFile(file);
  });

  ['vendor-name-source', 'purpose-text', 'category-manual'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderRuleSuggestion);
    el.addEventListener('change', renderRuleSuggestion);
  });

  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('click', () => document.getElementById('file-input').click());
  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add('active');
  }));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove('active');
  }));
  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  });

  document.addEventListener('paste', (event) => {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const pasted = new File([file], buildPastedFileName(file.type), { type: file.type });
          setSelectedFile(pasted);
          showToast('スクショを貼り付けました。');
          break;
        }
      }
    }
  });
}

async function loadBootstrap() {
  setLoading(true);
  try {
    const response = await fetch('/.netlify/functions/bootstrap');
    const data = await response.json();
    state.bootstrap = data;
    hydrateApp(data);
  } catch (error) {
    showToast('初期データの読み込みに失敗しました。');
  } finally {
    setLoading(false);
  }
}

function hydrateApp(data) {
  document.getElementById('app-title').textContent = data.appTitle;
  document.getElementById('project-name').value = data.defaultProjectName || '';
  document.getElementById('bootstrap-debug').textContent =
    `読込: 申請者 ${data.debug?.applicantCount || data.applicants.length}件 / 費目 ${data.debug?.categoryCount || data.categories.length}件 / ルール ${data.debug?.ruleCount || data.rules.length}件`;

  const applicantOptions = normalizeApplicantOptions(data.applicants);
  const categoryOptions = normalizeCategoryOptions(data.categories);
  populateSelect(document.getElementById('applicant-id'), applicantOptions);
  populateSelect(document.getElementById('category-manual'), [{ value: '', label: '自動候補を使う' }, ...categoryOptions]);
  populateSelect(document.getElementById('review-status'), data.statusOptions.map((item) => ({ value: item, label: item })));
  document.getElementById('review-status').value = '一次判定済み';
  document.getElementById('applicant-id').value = applicantOptions[0]?.value || '';
  renderDashboard(data.dashboard);
  renderRecentExpenses(data.recentExpenses);
  renderRuleSuggestion();
}

function populateSelect(element, options) {
  element.innerHTML = '';
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    element.appendChild(opt);
  });
}

function normalizeApplicantOptions(applicants) {
  const normalized = (Array.isArray(applicants) ? applicants : [])
    .map((item) => ({ value: String(item.applicant_id || '').trim(), label: String(item.applicant_name || '').trim() }))
    .filter((item) => item.value && item.label);
  return normalized.length ? normalized : [{ value: 'ITO', label: '伊東' }, { value: 'SAKASHITA', label: '坂下' }];
}

function normalizeCategoryOptions(categories) {
  const normalized = (Array.isArray(categories) ? categories : [])
    .map((item) => ({ value: String(item.category_code || '').trim(), label: String(item.category_name || '').trim() }))
    .filter((item) => item.value && item.label);
  return normalized.length ? normalized : [
    { value: 'AIR', label: '航空券' }, { value: 'TRANSPORT', label: '交通費' }, { value: 'HOTEL', label: '宿泊費' },
    { value: 'CAR', label: '車両費' }, { value: 'STAY', label: '滞在費' }, { value: 'MEAL', label: '会食費' },
    { value: 'ENTERTAINMENT', label: '接待費' }, { value: 'EVENT', label: 'イベント参加費' }, { value: 'OTHER', label: 'その他' },
  ];
}

function renderDashboard(dashboard) {
  const safeDashboard = {
    totalBudget: dashboard?.totalBudget || 0,
    totalSpent: dashboard?.totalSpent || 0,
    totalRemaining: dashboard?.totalRemaining || 0,
    currentMonthSpent: dashboard?.currentMonthSpent || 0,
    unconfirmedCount: dashboard?.unconfirmedCount || 0,
    categoryBreakdown: Array.isArray(dashboard?.categoryBreakdown) ? dashboard.categoryBreakdown : [],
  };
  document.getElementById('metric-budget').textContent = formatCurrency(safeDashboard.totalBudget);
  document.getElementById('metric-spent').textContent = formatCurrency(safeDashboard.totalSpent);
  document.getElementById('metric-remaining').textContent = formatCurrency(safeDashboard.totalRemaining);
  document.getElementById('metric-month').textContent = formatCurrency(safeDashboard.currentMonthSpent);
  document.getElementById('metric-unconfirmed').textContent = `${safeDashboard.unconfirmedCount}件`;

  const wrap = document.getElementById('category-breakdown');
  wrap.innerHTML = '';
  if (!safeDashboard.categoryBreakdown.length) {
    wrap.innerHTML = '<p class="empty-state">まだ支出データがありません。</p>';
    return;
  }
  const maxAmount = safeDashboard.categoryBreakdown[0].amount || 1;
  safeDashboard.categoryBreakdown.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <div class="breakdown-meta"><span>${item.categoryName}</span><strong>${formatCurrency(item.amount)}</strong></div>
      <div class="bar"><div class="bar-fill" style="width:${Math.max((item.amount / maxAmount) * 100, 6)}%"></div></div>
    `;
    wrap.appendChild(row);
  });
}

function renderRecentExpenses(expenses) {
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const body = document.getElementById('recent-expenses-body');
  body.innerHTML = '';
  if (!safeExpenses.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">まだ経費が登録されていません。</td></tr>';
    return;
  }
  safeExpenses.forEach((expense) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${expense.useDate || ''}</td><td>${expense.applicantName || ''}</td><td>${expense.vendorName || ''}</td><td>${expense.categoryName || ''}</td><td class="amount-cell">${formatCurrency(expense.amount || 0)}</td>`;
    body.appendChild(tr);
  });
}

function setSelectedFile(file) {
  state.selectedFile = file;
  state.selectedFileData = null;
  state.analysis = null;
  document.getElementById('selected-file-name').textContent = `${file.name} (${humanFileSize(file.size)})`;
  document.getElementById('analysis-status').textContent = '読み取り中...';
  document.getElementById('ocr-result-summary').textContent = '文字を読み取っています。しばらくお待ちください。';
  renderRuleSuggestion();
  analyzeSelectedFile(file);
}

async function analyzeSelectedFile(file) {
  setLoading(true);
  try {
    const fileData = await ensureFileData();
    const response = await fetch('/.netlify/functions/analyze-evidence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: fileData }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '読み取りに失敗しました。');
    state.analysis = result;
    applyAnalysisToForm(result);
  } catch (error) {
    document.getElementById('analysis-status').textContent = '読み取り失敗';
    document.getElementById('ocr-result-summary').textContent = error.message || '読み取りに失敗しました。';
    showToast(error.message || '読み取りに失敗しました。');
  } finally {
    setLoading(false);
  }
}

function applyAnalysisToForm(result) {
  document.getElementById('analysis-status').textContent = result.extractionStatus === 'ok' ? '読み取り完了' : '要確認';
  document.getElementById('ocr-result-summary').textContent = [
    result.vendorName ? `支払先: ${result.vendorName}` : '',
    result.useDate ? `利用日: ${result.useDate}` : '',
    result.amount ? `金額: ${formatCurrency(result.amount)}` : '',
    result.suggestedCategoryName ? `費目候補: ${result.suggestedCategoryName}` : '',
  ].filter(Boolean).join('\n') || '十分な情報を読み取れませんでした。必要な項目を手入力してください。';
  if (result.useDate) document.getElementById('use-date').value = result.useDate;
  if (result.amount) document.getElementById('amount-source').value = result.amount;
  if (result.vendorName) document.getElementById('vendor-name-source').value = result.vendorName;
  if (result.summary) document.getElementById('purpose-text').value = result.summary;
  renderRuleSuggestion();
}

function renderRuleSuggestion() {
  const manual = document.getElementById('category-manual').value;
  if (manual) {
    const category = state.bootstrap?.categories?.find((item) => item.category_code === manual);
    document.getElementById('rule-suggestion').textContent = `手動確定: ${category ? category.category_name : manual}`;
    return;
  }
  if (state.analysis?.suggestedCategoryName) {
    document.getElementById('rule-suggestion').textContent = state.analysis.suggestedCategoryName;
    return;
  }
  document.getElementById('rule-suggestion').textContent = '未判定';
}

async function onSubmit(event) {
  event.preventDefault();
  if (!state.selectedFile) {
    showToast('証憑ファイルを選択してください。');
    return;
  }
  const fileData = await ensureFileData();
  const payload = {
    applicantId: document.getElementById('applicant-id').value,
    useDate: document.getElementById('use-date').value,
    amountSource: document.getElementById('amount-source').value,
    vendorNameSource: document.getElementById('vendor-name-source').value,
    categoryManual: document.getElementById('category-manual').value,
    purposeText: document.getElementById('purpose-text').value,
    projectName: document.getElementById('project-name').value,
    attendeesText: document.getElementById('attendees-text').value,
    noteText: document.getElementById('note-text').value,
    reviewStatus: document.getElementById('review-status').value,
    file: fileData,
    analysis: state.analysis,
  };
  setLoading(true);
  try {
    const response = await fetch('/.netlify/functions/submit-expense', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '登録に失敗しました。');
    renderDashboard(result.dashboard);
    renderRecentExpenses(result.recentExpenses);
    resetFormAfterSubmit();
    showToast(`登録しました。ID: ${result.expenseId}`);
  } catch (error) {
    showToast(error.message || '登録に失敗しました。');
  } finally {
    setLoading(false);
  }
}

async function refreshDashboard() {
  setLoading(true);
  try {
    const response = await fetch('/.netlify/functions/refresh-dashboard');
    const result = await response.json();
    renderDashboard(result.dashboard);
    renderRecentExpenses(result.recentExpenses);
    showToast('集計を更新しました。');
  } catch (error) {
    showToast('集計更新に失敗しました。');
  } finally {
    setLoading(false);
  }
}

function resetFormAfterSubmit() {
  const applicantId = document.getElementById('applicant-id').value;
  const projectName = document.getElementById('project-name').value;
  document.getElementById('expense-form').reset();
  document.getElementById('applicant-id').value = applicantId;
  document.getElementById('project-name').value = projectName || state.bootstrap?.defaultProjectName || '';
  document.getElementById('review-status').value = '一次判定済み';
  document.getElementById('selected-file-name').textContent = '未選択';
  document.getElementById('analysis-status').textContent = '未解析';
  document.getElementById('ocr-result-summary').textContent = 'ファイルを入れると、ここに読み取り結果が表示されます。';
  state.selectedFile = null;
  state.selectedFileData = null;
  state.analysis = null;
  renderRuleSuggestion();
}

function ensureFileData() {
  if (state.selectedFileData) return Promise.resolve(state.selectedFileData);
  return readFileAsBase64(state.selectedFile).then((data) => {
    state.selectedFileData = data;
    return data;
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: String(reader.result || '').split(',')[1],
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setLoading(isLoading) {
  const submit = document.getElementById('submit-button');
  const refresh = document.getElementById('refresh-button');
  submit.disabled = isLoading;
  refresh.disabled = isLoading;
  submit.textContent = isLoading ? '処理中...' : 'Drive に保存して登録';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function humanFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  return `${size.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function buildPastedFileName(mimeType) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = mimeType && mimeType.includes('png') ? 'png' : 'jpg';
  return `screenshot-${stamp}.${extension}`;
}
