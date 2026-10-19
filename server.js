const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Detect Vercel Serverless environment
const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const BASE_STORAGE_DIR = isVercel ? '/tmp' : __dirname;

const DATA_DIR = path.join(BASE_STORAGE_DIR, 'data');
const UPLOADS_DIR = path.join(BASE_STORAGE_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERTS_DIR = path.join(BASE_STORAGE_DIR, 'certs');
const DB_PATH = path.join(DATA_DIR, 'attendance.db');
const CSV_PATH = path.join(DATA_DIR, 'attendance_records.csv');

// Ensure writable directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR, CERTS_DIR]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
}

// On Vercel, copy seed database from bundle to /tmp if not already there
if (isVercel) {
  const seedDbPath = path.join(__dirname, 'data', 'attendance.db');
  if (fs.existsSync(seedDbPath) && !fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(seedDbPath, DB_PATH);
    } catch (e) {
      console.warn('Could not copy seed database to /tmp:', e.message);
    }
  }
}

// Generate self-signed SSL certs if missing for local mobile HTTPS (skipped on Vercel / Cloud)
const KEY_PATH = path.join(CERTS_DIR, 'server.key');
const CERT_PATH = path.join(CERTS_DIR, 'server.crt');

function ensureSslCerts() {
  if (isVercel) return; // Vercel provides automatic edge SSL
  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
    try {
      console.log('Generating local SSL certificate for mobile HTTPS...');
      execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=attendance' -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365`, {
        stdio: 'ignore'
      });
      console.log('SSL certificate generated successfully.');
    } catch (err) {
      console.warn('Could not auto-generate SSL certs via openssl:', err.message);
    }
  }
}
ensureSslCerts();

// Find primary local LAN IPv4 address
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const localIp = getLocalIp();

// Initialize SQLite DB
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL DEFAULT 'CHECK-IN',
    created_at TEXT NOT NULL,
    formatted_time TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    site_name TEXT NOT NULL,
    address TEXT DEFAULT '',
    supervisor_name TEXT NOT NULL,
    supervisor_contact TEXT,
    notes TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    maps_url TEXT,
    photo_filename TEXT,
    synced_to_sheet INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Safe migration for existing databases: add entry_type and address if missing
try {
  db.exec(`ALTER TABLE attendance ADD COLUMN entry_type TEXT DEFAULT 'CHECK-IN'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE attendance ADD COLUMN address TEXT DEFAULT ''`);
} catch (e) {}

// Prepared statements
const stmtInsert = db.prepare(`
  INSERT INTO attendance (
    id, entry_type, created_at, formatted_time, worker_name, worker_id,
    purpose, site_name, address, supervisor_name, supervisor_contact,
    notes, latitude, longitude, accuracy, maps_url, photo_filename, synced_to_sheet
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?
  )
`);

const stmtGetAll = db.prepare(`SELECT * FROM attendance ORDER BY datetime(created_at) DESC`);
const stmtGetByWorker = db.prepare(`SELECT * FROM attendance WHERE worker_id = ? ORDER BY datetime(created_at) DESC`);
const stmtGetUnsynced = db.prepare(`SELECT * FROM attendance WHERE synced_to_sheet = 0 ORDER BY datetime(created_at) ASC`);
const stmtGetWorkerLatest = db.prepare(`SELECT * FROM attendance WHERE worker_id = ? ORDER BY datetime(created_at) DESC LIMIT 1`);
const stmtMarkSynced = db.prepare(`UPDATE attendance SET synced_to_sheet = 1 WHERE id = ?`);
const stmtGetSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
const stmtSetSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);

function getSetting(key, defaultValue = '') {
  const row = stmtGetSetting.get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  stmtSetSetting.run(key, String(value || ''));
}

function getManagerPin() {
  return getSetting('manager_pin', '2026');
}

function verifyManagerPin(req, parsedUrl) {
  const pinHeader = req.headers['x-manager-pin'];
  const pinQuery = parsedUrl ? parsedUrl.searchParams.get('pin') : null;
  const provided = String(pinHeader || pinQuery || '').trim();
  const actual = String(getManagerPin()).trim();
  return provided && provided === actual;
}

// CSV Management
const CSV_HEADERS = [
  'Record ID',
  'Timestamp (ISO)',
  'Date & Time',
  'Punch Type',
  'Field Worker Name',
  'Worker ID / Phone',
  'Purpose / Activity',
  'Site / Location Name',
  'Readable Address',
  'Supervisor Name',
  'Supervisor Contact',
  'Latitude',
  'Longitude',
  'Accuracy (meters)',
  'Google Maps Link',
  'Photo URL',
  'Notes / Remarks',
  'Synced to Google Sheet'
];

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function initCsvIfMissing() {
  if (!fs.existsSync(CSV_PATH) || fs.statSync(CSV_PATH).size === 0) {
    const bom = '\uFEFF';
    const headerRow = CSV_HEADERS.map(escapeCsvField).join(',') + '\n';
    fs.writeFileSync(CSV_PATH, bom + headerRow, 'utf8');
  } else {
    try {
      const firstLine = fs.readFileSync(CSV_PATH, 'utf8').split('\n')[0];
      if (!firstLine.includes('Readable Address')) {
        regenerateFullCsv(`http://${localIp}:${HTTP_PORT}`);
      }
    } catch (e) {}
  }
}

function appendToCsv(record, baseUrl) {
  initCsvIfMissing();
  const photoUrl = record.photo_filename ? `${baseUrl}/uploads/${record.photo_filename}` : '';
  const row = [
    record.id,
    record.created_at,
    record.formatted_time,
    record.entry_type || 'CHECK-IN',
    record.worker_name,
    record.worker_id,
    record.purpose,
    record.site_name,
    record.address || '',
    record.supervisor_name,
    record.supervisor_contact || '',
    record.latitude !== null ? record.latitude : '',
    record.longitude !== null ? record.longitude : '',
    record.accuracy !== null ? record.accuracy : '',
    record.maps_url || '',
    photoUrl,
    record.notes || '',
    record.synced_to_sheet ? 'YES' : 'NO'
  ].map(escapeCsvField).join(',') + '\n';

  fs.appendFileSync(CSV_PATH, row, 'utf8');
}

function regenerateFullCsv(baseUrl) {
  const records = stmtGetAll.all();
  const bom = '\uFEFF';
  const headerRow = CSV_HEADERS.map(escapeCsvField).join(',') + '\n';
  const rows = records.map(record => {
    const photoUrl = record.photo_filename ? `${baseUrl}/uploads/${record.photo_filename}` : '';
    return [
      record.id,
      record.created_at,
      record.formatted_time,
      record.entry_type || 'CHECK-IN',
      record.worker_name,
      record.worker_id,
      record.purpose,
      record.site_name,
      record.address || '',
      record.supervisor_name,
      record.supervisor_contact || '',
      record.latitude !== null ? record.latitude : '',
      record.longitude !== null ? record.longitude : '',
      record.accuracy !== null ? record.accuracy : '',
      record.maps_url || '',
      photoUrl,
      record.notes || '',
      record.synced_to_sheet ? 'YES' : 'NO'
    ].map(escapeCsvField).join(',');
  }).join('\n');

  fs.writeFileSync(CSV_PATH, bom + headerRow + (rows ? rows + '\n' : ''), 'utf8');
}

initCsvIfMissing();

// =========================================================================
// Google Sheets Integration (Direct Google API + Webhook)
// =========================================================================

function base64UrlEncode(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(str).toString('base64url');
}

let cachedServiceAccountToken = null;
let tokenExpiryTime = 0;

async function getServiceAccountAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceAccountToken && now < tokenExpiryTime - 60) {
    return cachedServiceAccountToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(claim)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Google Service Account token request failed');
  }

  cachedServiceAccountToken = data.access_token;
  tokenExpiryTime = now + (data.expires_in || 3600);
  return cachedServiceAccountToken;
}

function extractSpreadsheetId(url) {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : (url.length > 20 && !url.includes('/') ? url : null);
}

function getServiceAccountCredentials() {
  const fileCandidates = [
    path.join(__dirname, 'credentials.json'),
    path.join(__dirname, 'service-account.json'),
    path.join(DATA_DIR, 'credentials.json'),
    path.join(DATA_DIR, 'service-account.json')
  ];

  for (const p of fileCandidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.client_email && parsed.private_key) return parsed;
      } catch (e) {}
    }
  }

  const jsonSetting = getSetting('google_service_account_json', '');
  if (jsonSetting) {
    try {
      const parsed = JSON.parse(jsonSetting);
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch (e) {}
  }

  return null;
}

function safeSheetsText(str) {
  if (str === null || str === undefined) return '';
  const s = String(str).trim();
  if (s.startsWith('+') || s.startsWith('=')) {
    return "'" + s;
  }
  return s;
}

async function sendDirectToGoogleSheetApi(spreadsheetId, record, baseUrl, credentials) {
  const token = await getServiceAccountAccessToken(credentials);
  const photoUrl = record.photo_filename ? `${baseUrl}/uploads/${record.photo_filename}` : '';
  const rowValues = [
    record.id,
    record.created_at,
    record.formatted_time,
    record.entry_type || 'CHECK-IN',
    record.worker_name,
    safeSheetsText(record.worker_id),
    record.purpose,
    record.site_name,
    record.address || '',
    record.supervisor_name,
    safeSheetsText(record.supervisor_contact),
    record.latitude !== null && record.latitude !== undefined ? record.latitude : '',
    record.longitude !== null && record.longitude !== undefined ? record.longitude : '',
    record.accuracy !== null && record.accuracy !== undefined ? record.accuracy : '',
    record.maps_url || '',
    photoUrl,
    record.notes || ''
  ];

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [rowValues] })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Google API error (HTTP ${res.status})`);
  }
  return { success: true, updatedRange: data.updates?.updatedRange };
}

// Sync to Google Sheet via Webhook (Google Apps Script)
async function sendToGoogleSheetWebhook(webhookUrl, record, baseUrl) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, error: 'No valid webhook URL configured' };
  }

  const payload = {
    id: record.id,
    entry_type: record.entry_type || 'CHECK-IN',
    timestamp: record.created_at,
    formatted_time: record.formatted_time,
    worker_name: record.worker_name,
    worker_id: safeSheetsText(record.worker_id),
    purpose: record.purpose,
    site_name: record.site_name,
    address: record.address || '',
    supervisor_name: record.supervisor_name,
    supervisor_contact: safeSheetsText(record.supervisor_contact),
    notes: record.notes || '',
    latitude: record.latitude,
    longitude: record.longitude,
    accuracy: record.accuracy,
    maps_url: record.maps_url,
    photo_url: record.photo_filename ? `${baseUrl}/uploads/${record.photo_filename}` : ''
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await response.text();

    if (text.includes('Page not found') || text.includes('unable to open the file') || text.includes('ServiceLogin')) {
      return {
        success: false,
        error: "Google Apps Script authorization error: Deployment access MUST be set to 'Anyone' (not 'Only myself'). Also ensure you clicked 'Deploy > New deployment'."
      };
    }

    if (response.status === 405 || response.headers.get('allow')?.includes('GET')) {
      return {
        success: false,
        error: "Google Apps Script does not have a doPost() function deployed. Please ensure doPost(e) is saved and redeployed as 'New version'."
      };
    }

    try {
      const json = JSON.parse(text);
      if (json.status === 'ok' || json.success) {
        return { success: true };
      }
      if (json.status === 'error' || json.message) {
        return { success: false, error: json.message || json.error };
      }
    } catch (_) {}

    if (response.ok || response.status === 302) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 150)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Unified sync helper (tries Service Account first, then Webhook)
async function syncRecordToGoogleSheet(record, baseUrl) {
  const creds = getServiceAccountCredentials();
  const sheetUrl = getSetting('google_sheet_url', '');
  const sheetId = extractSpreadsheetId(sheetUrl);

  if (creds && sheetId) {
    try {
      const res = await sendDirectToGoogleSheetApi(sheetId, record, baseUrl, creds);
      return { success: true, method: 'service_account', details: res };
    } catch (err) {
      return { success: false, method: 'service_account', error: err.message };
    }
  }

  const webhookUrl = getSetting('google_sheet_webhook_url', '');
  if (webhookUrl && webhookUrl.startsWith('http')) {
    const res = await sendToGoogleSheetWebhook(webhookUrl, record, baseUrl);
    return { ...res, method: 'webhook' };
  }

  return { success: false, error: 'No Google Sheet integration configured (neither Service Account nor Webhook URL)' };
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

// Core Request Handler (Shared by HTTP and HTTPS)
async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const isHttps = !!(req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https');
  const protocol = isHttps ? 'https' : 'http';
  const port = isHttps ? HTTPS_PORT : HTTP_PORT;
  const host = req.headers.host || `${localIp}:${port}`;
  const baseUrl = `${protocol}://${host}`;
  const parsedUrl = new URL(req.url, baseUrl);
  const pathname = parsedUrl.pathname;

  const sendJson = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  const readBody = () => new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') return resolve(req.body);
      return resolve(JSON.stringify(req.body));
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  try {
    // API: Network Info for Phone Access
    if (req.method === 'GET' && pathname === '/api/network-info') {
      return sendJson({
        local_ip: localIp,
        http_port: HTTP_PORT,
        https_port: HTTPS_PORT,
        http_url: `http://${localIp}:${HTTP_PORT}`,
        https_url: `https://${localIp}:${HTTPS_PORT}`,
        is_https: isHttps
      });
    }

    // API: GET /api/worker-status?worker_id=...
    if (req.method === 'GET' && pathname === '/api/worker-status') {
      const workerId = parsedUrl.searchParams.get('worker_id');
      if (!workerId) {
        return sendJson({ success: false, error: 'worker_id is required' }, 400);
      }
      const latest = stmtGetWorkerLatest.get(String(workerId).trim());
      return sendJson({
        success: true,
        has_record: !!latest,
        status: latest ? (latest.entry_type || 'CHECK-IN') : 'NONE',
        latest_record: latest ? {
          ...latest,
          photo_url: latest.photo_filename ? `${baseUrl}/uploads/${latest.photo_filename}` : null
        } : null
      });
    }

    // API: GET /api/attendance
    if (req.method === 'GET' && pathname === '/api/attendance') {
      const workerId = parsedUrl.searchParams.get('worker_id');

      // Worker requesting their own attendance history: return ONLY their records (no PIN needed)
      if (workerId) {
        const records = stmtGetByWorker.all(String(workerId).trim());
        return sendJson({
          success: true,
          is_worker_view: true,
          worker_id: workerId,
          count: records.length,
          records: records.map(r => ({
            ...r,
            photo_url: r.photo_filename ? `${baseUrl}/uploads/${r.photo_filename}` : null
          }))
        });
      }

      // Requesting all workers' attendance: requires Manager PIN!
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({
          success: false,
          error: 'Manager PIN required to access full attendance records.',
          auth_required: true
        }, 401);
      }

      const records = stmtGetAll.all();
      return sendJson({
        success: true,
        is_manager_view: true,
        count: records.length,
        records: records.map(r => ({
          ...r,
          photo_url: r.photo_filename ? `${baseUrl}/uploads/${r.photo_filename}` : null
        }))
      });
    }

    // API: POST /api/attendance
    if (req.method === 'POST' && pathname === '/api/attendance') {
      const rawBody = await readBody();
      const data = JSON.parse(rawBody);

      if (!data.worker_name || !data.worker_id || !data.purpose) {
        return sendJson({ success: false, error: 'Worker name, ID, and purpose are required.' }, 400);
      }

      const id = crypto.randomUUID();
      const now = new Date();
      const createdAt = now.toISOString();

      const formattedTime = now.toLocaleString('en-US', {
        timeZone: data.timeZone || undefined,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      let photoFilename = null;

      if (data.photo_base64) {
        try {
          const match = data.photo_base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          let ext = 'jpg';
          let base64Data = data.photo_base64;

          if (match) {
            ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            base64Data = match[2];
          }

          photoFilename = `${id}.${ext}`;
          const filePath = path.join(UPLOADS_DIR, photoFilename);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        } catch (imgErr) {
          console.error('Failed to save image:', imgErr);
        }
      }

      const lat = data.latitude !== undefined && data.latitude !== null && !isNaN(data.latitude) ? parseFloat(data.latitude) : null;
      const lng = data.longitude !== undefined && data.longitude !== null && !isNaN(data.longitude) ? parseFloat(data.longitude) : null;
      const acc = data.accuracy !== undefined && data.accuracy !== null && !isNaN(data.accuracy) ? parseFloat(data.accuracy) : null;
      const mapsUrl = (lat !== null && lng !== null) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

      const entryType = (String(data.entry_type || '').toUpperCase() === 'CHECK-OUT') ? 'CHECK-OUT' : 'CHECK-IN';

      const record = {
        id,
        entry_type: entryType,
        created_at: createdAt,
        formatted_time: formattedTime,
        worker_name: String(data.worker_name).trim(),
        worker_id: String(data.worker_id).trim(),
        purpose: String(data.purpose).trim(),
        site_name: String(data.site_name || '').trim(),
        address: String(data.address || '').trim(),
        supervisor_name: String(data.supervisor_name || '').trim(),
        supervisor_contact: String(data.supervisor_contact || '').trim(),
        notes: String(data.notes || '').trim(),
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        maps_url: mapsUrl,
        photo_filename: photoFilename,
        synced_to_sheet: 0
      };

      const syncResult = await syncRecordToGoogleSheet(record, baseUrl);
      if (syncResult.success) {
        record.synced_to_sheet = 1;
      }

      stmtInsert.run(
        record.id,
        record.entry_type,
        record.created_at,
        record.formatted_time,
        record.worker_name,
        record.worker_id,
        record.purpose,
        record.site_name,
        record.address,
        record.supervisor_name,
        record.supervisor_contact,
        record.notes,
        record.latitude,
        record.longitude,
        record.accuracy,
        record.maps_url,
        record.photo_filename,
        record.synced_to_sheet
      );

      appendToCsv(record, baseUrl);

      return sendJson({
        success: true,
        message: `${entryType === 'CHECK-OUT' ? 'Check-Out' : 'Check-In'} recorded successfully`,
        record: {
          ...record,
          photo_url: photoFilename ? `${baseUrl}/uploads/${photoFilename}` : null
        }
      }, 201);
    }

    // API: POST /api/verify-manager-pin
    if (req.method === 'POST' && pathname === '/api/verify-manager-pin') {
      const rawBody = await readBody();
      const data = JSON.parse(rawBody || '{}');
      const pin = String(data.pin || '').trim();
      if (!pin) {
        return sendJson({ success: false, error: 'PIN is required' }, 400);
      }
      if (pin === getManagerPin()) {
        return sendJson({ success: true, message: 'Manager PIN verified' });
      }
      return sendJson({ success: false, error: 'Incorrect Manager PIN' }, 401);
    }

    // API: POST /api/change-manager-pin
    if (req.method === 'POST' && pathname === '/api/change-manager-pin') {
      const rawBody = await readBody();
      const data = JSON.parse(rawBody || '{}');
      const currentPin = String(data.current_pin || '').trim();
      const newPin = String(data.new_pin || '').trim();

      if (currentPin !== getManagerPin()) {
        return sendJson({ success: false, error: 'Current Manager PIN is incorrect' }, 401);
      }
      if (!newPin || newPin.length < 4) {
        return sendJson({ success: false, error: 'New PIN must be at least 4 digits' }, 400);
      }
      setSetting('manager_pin', newPin);
      return sendJson({ success: true, message: 'Manager PIN updated successfully' });
    }

    // API: GET /api/export.csv (Manager Only)
    if (req.method === 'GET' && pathname === '/api/export.csv') {
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({ success: false, error: 'Manager PIN required to export attendance.' }, 401);
      }
      regenerateFullCsv(baseUrl);
      const csvData = fs.readFileSync(CSV_PATH);
      const filename = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      });
      res.end(csvData);
      return;
    }

    // API: GET /api/settings (Manager Only)
    if (req.method === 'GET' && pathname === '/api/settings') {
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({ success: false, error: 'Manager PIN required to access settings.' }, 401);
      }
      const records = stmtGetAll.all();
      const unsyncedCount = records.filter(r => !r.synced_to_sheet).length;
      const creds = getServiceAccountCredentials();
      const webhookUrl = getSetting('google_sheet_webhook_url', '');
      const activeMethod = creds ? 'service_account' : (webhookUrl ? 'webhook' : 'none');

      return sendJson({
        success: true,
        settings: {
          google_sheet_url: getSetting('google_sheet_url', ''),
          google_sheet_webhook_url: webhookUrl,
          has_service_account: !!creds,
          service_account_email: creds ? creds.client_email : null,
          active_integration_method: activeMethod,
          organization_name: getSetting('organization_name', 'NGO Field Operations')
        },
        stats: {
          total_records: records.length,
          unsynced_records: unsyncedCount,
          synced_records: records.length - unsyncedCount,
          local_csv_path: CSV_PATH
        }
      });
    }

    // API: POST /api/settings (Manager Only)
    if (req.method === 'POST' && pathname === '/api/settings') {
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({ success: false, error: 'Manager PIN required to modify settings.' }, 401);
      }
      const rawBody = await readBody();
      const data = JSON.parse(rawBody);

      if (data.google_sheet_url !== undefined) setSetting('google_sheet_url', data.google_sheet_url);
      if (data.google_sheet_webhook_url !== undefined) setSetting('google_sheet_webhook_url', data.google_sheet_webhook_url);
      if (data.google_service_account_json !== undefined) setSetting('google_service_account_json', data.google_service_account_json);
      if (data.organization_name !== undefined) setSetting('organization_name', data.organization_name);

      return sendJson({ success: true, message: 'Settings saved' });
    }

    // API: POST /api/sync-to-sheet (Manager Only)
    if (req.method === 'POST' && pathname === '/api/sync-to-sheet') {
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({ success: false, error: 'Manager PIN required to sync records.' }, 401);
      }
      const unsynced = stmtGetUnsynced.all();
      if (unsynced.length === 0) {
        return sendJson({ success: true, message: 'All records are already synced!', synced_count: 0 });
      }

      let successCount = 0;
      let errors = [];

      for (const rec of unsynced) {
        const res = await syncRecordToGoogleSheet(rec, baseUrl);
        if (res.success) {
          stmtMarkSynced.run(rec.id);
          successCount++;
        } else {
          errors.push(`Record ${rec.id}: ${res.error}`);
        }
      }

      regenerateFullCsv(baseUrl);

      return sendJson({
        success: successCount > 0,
        synced_count: successCount,
        failed_count: unsynced.length - successCount,
        errors: errors.slice(0, 5)
      });
    }

    // API: POST /api/test-webhook (Manager Only)
    if (req.method === 'POST' && pathname === '/api/test-webhook') {
      if (!verifyManagerPin(req, parsedUrl)) {
        return sendJson({ success: false, error: 'Manager PIN required to test connection.' }, 401);
      }
      const rawBody = await readBody();
      const data = JSON.parse(rawBody || '{}');
      const testUrl = data.webhook_url || getSetting('google_sheet_webhook_url');

      const testRecord = {
        id: 'TEST-' + Date.now().toString(36),
        created_at: new Date().toISOString(),
        formatted_time: new Date().toLocaleString(),
        entry_type: 'CHECK-IN',
        worker_name: 'Test Field Worker',
        worker_id: 'NGO-TEST-001',
        purpose: 'Integration Verification',
        site_name: 'Headquarters / Test Site',
        address: 'Test Location Address',
        supervisor_name: 'Field Director',
        supervisor_contact: 'director@ngo.org',
        notes: 'Test ping from NGO Attendance Web App',
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 5.0,
        maps_url: 'https://www.google.com/maps?q=28.6139,77.2090',
        photo_filename: null
      };

      if (data.method === 'service_account' || (!testUrl && getServiceAccountCredentials())) {
        const creds = getServiceAccountCredentials();
        const sheetUrl = data.sheet_url || getSetting('google_sheet_url');
        const sheetId = extractSpreadsheetId(sheetUrl);
        if (!creds) return sendJson({ success: false, error: 'No Service Account JSON found or saved.' }, 400);
        if (!sheetId) return sendJson({ success: false, error: 'Invalid Google Sheet URL' }, 400);

        try {
          const res = await sendDirectToGoogleSheetApi(sheetId, testRecord, baseUrl, creds);
          return sendJson({ success: true, method: 'direct_api', message: 'Test row appended via Google Sheets API!' });
        } catch (err) {
          return sendJson({ success: false, method: 'direct_api', error: err.message });
        }
      }

      if (!testUrl) {
        return sendJson({ success: false, error: 'Please enter a webhook URL to test' }, 400);
      }

      const result = await sendToGoogleSheetWebhook(testUrl, testRecord, baseUrl);
      return sendJson(result);
    }

    // Serve uploaded photos: /uploads/<filename>
    if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, filename);

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Image not found');
        return;
      }
    }

    // Static files
    if (req.method === 'GET') {
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(PUBLIC_DIR, safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(indexPath).pipe(res);
          return;
        }
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson({ success: false, error: err.message || 'Internal Server Error' }, 500);
  }
}

// Start standalone server when executed directly (npm start / node server.js)
if (require.main === module) {
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n============================================================`);
    console.log(`📋 NGO Field Attendance Server Running!`);
    console.log(`• Desktop (Local):  http://localhost:${HTTP_PORT}`);
    console.log(`• Phone (HTTP):     http://${localIp}:${HTTP_PORT}`);
    console.log(`============================================================`);
  });

  // Start HTTPS Server (Only needed locally for Phone Camera & GPS permissions; cloud hosts handle SSL on port 443 automatically)
  const isCloudHosting = !!(process.env.RENDER || (process.env.PORT && process.env.PORT !== '3000' && !process.env.HTTPS_PORT));

  if (!isCloudHosting && fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    try {
      const sslOptions = {
        key: fs.readFileSync(KEY_PATH),
        cert: fs.readFileSync(CERT_PATH)
      };
      const httpsServer = https.createServer(sslOptions, handleRequest);
      httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`🔒 SECURE HTTPS SERVER (Required for Phone Camera & GPS):`);
        console.log(`• Desktop (HTTPS):  https://localhost:${HTTPS_PORT}`);
        console.log(`• Phone (HTTPS):    https://${localIp}:${HTTPS_PORT}  <-- USE THIS ON PHONE!`);
        console.log(`============================================================\n`);
      });
    } catch (sslErr) {
      console.warn('Could not start HTTPS server:', sslErr.message);
    }
  }
}

// Export request handler for Vercel Serverless Functions
module.exports = handleRequest;
