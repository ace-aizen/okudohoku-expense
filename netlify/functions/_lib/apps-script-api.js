const APPS_SCRIPT_WEB_APP_URL = process.env.APPS_SCRIPT_WEB_APP_URL || '';
const APPS_SCRIPT_API_KEY = process.env.APPS_SCRIPT_API_KEY || '';

function hasAppsScriptConfig() {
  return Boolean(APPS_SCRIPT_WEB_APP_URL);
}

async function callAppsScriptApi(action, payload = {}) {
  if (!APPS_SCRIPT_WEB_APP_URL) {
    throw new Error('APPS_SCRIPT_WEB_APP_URL が未設定です。');
  }

  const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action,
      apiKey: APPS_SCRIPT_API_KEY,
      ...payload,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Apps Script API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  if (!data || data.ok === false) {
    throw new Error(data && data.error ? data.error : 'Apps Script API 呼び出しに失敗しました。');
  }
  return data;
}

module.exports = {
  hasAppsScriptConfig,
  callAppsScriptApi,
};
