const { googleFetch } = require('./google-auth');

const DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '';

async function ensureChildFolder(parentId, name) {
  const query = encodeURIComponent(`'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${name.replace(/'/g, "\\'")}'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&includeItemsFromAllDrives=true&supportsAllDrives=true`;
  const existing = await googleFetch(url);
  const data = await existing.json();
  if (data.files && data.files.length) {
    return data.files[0];
  }

  const created = await googleFetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  return created.json();
}

async function ensureMonthFolder(useDate) {
  const base = useDate ? new Date(`${useDate}T00:00:00+09:00`) : new Date();
  const year = String(base.getFullYear());
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const yearFolder = await ensureChildFolder(DRIVE_ROOT_FOLDER_ID, year);
  return ensureChildFolder(yearFolder.id, month);
}

function defaultExtensionForMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return '';
}

function getExtension(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

async function uploadFileToDrive({ fileName, mimeType, base64Data, parentId }) {
  const boundary = `----netlify-boundary-${Date.now()}`;
  const metadata = {
    name: fileName,
    parents: parentId ? [parentId] : undefined,
  };
  const fileBuffer = Buffer.from(base64Data, 'base64');
  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([preamble, fileBuffer, closing]);

  const response = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  return response.json();
}

async function saveOriginalEvidence({ expenseId, originalFileName, mimeType, base64Data, useDate }) {
  const monthFolder = await ensureMonthFolder(useDate);
  const extension = getExtension(originalFileName) || defaultExtensionForMime(mimeType);
  const savedName = `${expenseId}${extension ? `.${extension}` : ''}`;
  return uploadFileToDrive({
    fileName: savedName,
    mimeType,
    base64Data,
    parentId: monthFolder.id,
  });
}

async function runDriveOcr({ fileName, mimeType, base64Data }) {
  const tempFolder = await ensureChildFolder(DRIVE_ROOT_FOLDER_ID, '99_ocr_temp');
  const multipart = buildOcrMultipartBody({
    fileName,
    mimeType,
    base64Data,
    parentId: tempFolder.id,
  });

  let converted;
  const convertResponse = await googleFetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=ja&fields=id,name&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${multipart.boundary}` },
      body: multipart.body,
    }
  );

  try {
    converted = await convertResponse.json();
    const textResponse = await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${converted.id}/export?mimeType=text/plain`,
      { method: 'GET' }
    );
    return await textResponse.text();
  } finally {
    if (converted && converted.id) {
      await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${converted.id}?supportsAllDrives=true`,
        { method: 'DELETE' }
      );
    }
  }
}

function buildOcrMultipartBody({ fileName, mimeType, base64Data, parentId }) {
  const boundary = `ocr-boundary-${Date.now()}`;
  const metadata = {
    name: `OCR-${Date.now()}-${fileName}`,
    mimeType: 'application/vnd.google-apps.document',
    parents: parentId ? [parentId] : [DRIVE_ROOT_FOLDER_ID],
  };
  const fileBuffer = Buffer.from(base64Data, 'base64');
  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  return {
    boundary,
    body: Buffer.concat([preamble, fileBuffer, closing]),
  };
}

module.exports = {
  saveOriginalEvidence,
  runDriveOcr,
};
