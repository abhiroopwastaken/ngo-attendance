/**
 * JKLFDP Attendance System - Dedicated Project Manager Portal
 * Handles password authentication, 30-day token persistence, full records inspection,
 * Google Sheet webhook/API synchronization, CSV exports, and password management.
 */

const STORAGE_TOKEN_KEY = 'jklfdp_manager_token';
const STORAGE_EXPIRY_KEY = 'jklfdp_manager_token_expiry';

// State
const adminState = {
  token: null,
  records: [],
  filter: 'ALL', // 'ALL', 'CHECK-IN', 'CHECK-OUT'
  searchQuery: '',
  settings: {},
  clockInterval: null
};

// DOM references
const adminDom = {
  headerClock: document.getElementById('headerClock'),
  btnAdminSignOut: document.getElementById('btnAdminSignOut'),
  
  // Login Section
  loginSection: document.getElementById('adminLoginSection'),
  loginForm: document.getElementById('adminLoginForm'),
  passwordInput: document.getElementById('adminPasswordInput'),
  rememberMeCheck: document.getElementById('adminRememberMe'),
  loginError: document.getElementById('adminLoginError'),
  btnSignIn: document.getElementById('btnAdminSignIn'),

  // Dashboard Section
  dashboardSection: document.getElementById('adminDashboardSection'),
  statTotalPunches: document.getElementById('statTotalPunches'),
  statCheckIns: document.getElementById('statCheckIns'),
  statCheckOuts: document.getElementById('statCheckOuts'),
  managerUnsyncedCount: document.getElementById('managerUnsyncedCount'),
  btnSyncPendingCount: document.getElementById('btnSyncPendingCount'),
  btnManagerExportCsv: document.getElementById('btnManagerExportCsv'),
  btnSyncNow: document.getElementById('btnSyncNow'),

  // Filters & List
  pillFilterAll: document.getElementById('pillManagerFilterAll'),
  pillFilterCheckIn: document.getElementById('pillManagerFilterCheckIn'),
  pillFilterCheckOut: document.getElementById('pillManagerFilterCheckOut'),
  countAll: document.getElementById('countManagerAll'),
  countCheckIn: document.getElementById('countManagerCheckIn'),
  countCheckOut: document.getElementById('countManagerCheckOut'),
  searchInput: document.getElementById('managerSearchInput'),
  recordsList: document.getElementById('managerRecordsList'),

  // Modals
  changePasswordModal: document.getElementById('changePasswordModal'),
  changePasswordError: document.getElementById('changePasswordError'),
  inputCurrentPassword: document.getElementById('inputCurrentPassword'),
  inputNewPassword: document.getElementById('inputNewPassword'),
  inputConfirmNewPassword: document.getElementById('inputConfirmNewPassword'),

  sheetConfigModal: document.getElementById('sheetConfigModal'),
  googleSheetUrlInput: document.getElementById('googleSheetUrlInput'),
  googleWebhookInput: document.getElementById('googleWebhookInput'),
  currentSheetDisplay: document.getElementById('currentSheetDisplay'),
  btnOpenGoogleSheet: document.getElementById('btnOpenGoogleSheet'),
  serviceAccountJsonInput: document.getElementById('serviceAccountJsonInput'),

  photoModal: document.getElementById('photoModal'),
  fullPhotoImg: document.getElementById('fullPhotoImg'),
  photoModalMeta: document.getElementById('photoModalMeta'),
  toast: document.getElementById('toast')
};

// =========================================================================
// Initialization & Live Clock
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();
  initAuth();
});

function startLiveClock() {
  function updateTime() {
    const now = new Date();
    if (adminDom.headerClock) {
      adminDom.headerClock.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
  updateTime();
  adminState.clockInterval = setInterval(updateTime, 1000);
}

// =========================================================================
// Token Storage & Authentication
// =========================================================================

function getStoredToken() {
  // Check localStorage first (with expiration check)
  const localToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
  if (localToken) {
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      clearStoredToken();
      return null;
    }
    return localToken;
  }
  // Check sessionStorage (session only)
  return sessionStorage.getItem(STORAGE_TOKEN_KEY);
}

function saveToken(token, rememberMe) {
  adminState.token = token;
  if (rememberMe) {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + thirtyDaysMs));
  } else {
    sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
  }
}

function clearStoredToken() {
  adminState.token = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
}

async function initAuth() {
  const token = getStoredToken();
  if (token) {
    adminState.token = token;
    // Attempt auto-login with stored token
    const ok = await verifyTokenAndLoad(token);
    if (!ok) {
      showLoginView();
      if (adminDom.loginError) {
        adminDom.loginError.textContent = 'Your previous manager session has expired. Please sign in again.';
        adminDom.loginError.style.display = 'block';
      }
    }
  } else {
    showLoginView();
  }
}

function showLoginView() {
  if (adminDom.loginSection) adminDom.loginSection.style.display = 'flex';
  if (adminDom.dashboardSection) adminDom.dashboardSection.style.display = 'none';
  if (adminDom.btnAdminSignOut) adminDom.btnAdminSignOut.style.display = 'none';
  if (adminDom.passwordInput) adminDom.passwordInput.focus();
}

function showDashboardView() {
  if (adminDom.loginSection) adminDom.loginSection.style.display = 'none';
  if (adminDom.dashboardSection) adminDom.dashboardSection.style.display = 'block';
  if (adminDom.btnAdminSignOut) adminDom.btnAdminSignOut.style.display = 'inline-flex';
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();

  const password = adminDom.passwordInput ? adminDom.passwordInput.value.trim() : '';
  const rememberMe = adminDom.rememberMeCheck ? adminDom.rememberMeCheck.checked : true;

  if (!password) {
    showLoginError('Please enter your manager password.');
    return;
  }

  if (adminDom.loginError) adminDom.loginError.style.display = 'none';
  if (adminDom.btnSignIn) {
    adminDom.btnSignIn.disabled = true;
    adminDom.btnSignIn.textContent = 'Verifying credentials...';
  }

  try {
    const res = await fetch('/api/verify-manager-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      saveToken(data.token, rememberMe);
      if (adminDom.passwordInput) adminDom.passwordInput.value = '';
      showDashboardView();
      await loadAdminDashboard();
      showToast('✓ Manager Access Granted');
    } else {
      showLoginError(data.error || 'Incorrect password. Please try again.');
    }
  } catch (err) {
    showLoginError('Network error connecting to authentication server. Please retry.');
  } finally {
    if (adminDom.btnSignIn) {
      adminDom.btnSignIn.disabled = false;
      adminDom.btnSignIn.textContent = 'Sign In to Admin Portal';
    }
  }
}

function showLoginError(msg) {
  if (adminDom.loginError) {
    adminDom.loginError.textContent = msg;
    adminDom.loginError.style.display = 'block';
  }
}

function adminSignOut() {
  clearStoredToken();
  adminState.records = [];
  showLoginView();
  showToast('🔒 Signed out of Admin Portal');
}

// =========================================================================
// Dashboard Data Fetching & Rendering
// =========================================================================

async function verifyTokenAndLoad(token) {
  try {
    const res = await fetch('/api/attendance', {
      headers: { 'X-Manager-Token': token }
    });
    if (res.status === 401) {
      clearStoredToken();
      return false;
    }
    const data = await res.json();
    if (data.success) {
      showDashboardView();
      adminState.records = data.records || [];
      updateDashboardStats(adminState.records);
      updateCsvExportLink();
      applyFilters();
      loadSettings();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to verify token:', err);
    return false;
  }
}

async function loadAdminDashboard() {
  if (!adminState.token) {
    showLoginView();
    return;
  }

  updateCsvExportLink();

  try {
    const res = await fetch('/api/attendance', {
      headers: { 'X-Manager-Token': adminState.token }
    });
    if (res.status === 401) {
      adminSignOut();
      showLoginError('Session expired. Please sign in again.');
      return;
    }
    const data = await res.json();
    if (data.success) {
      adminState.records = data.records || [];
      updateDashboardStats(adminState.records);
      applyFilters();
      loadSettings();
    }
  } catch (err) {
    showToast('Failed to load attendance records: ' + err.message);
  }
}

function updateCsvExportLink() {
  if (adminDom.btnManagerExportCsv && adminState.token) {
    adminDom.btnManagerExportCsv.href = `/api/export.csv?token=${encodeURIComponent(adminState.token)}`;
  }
}

function updateDashboardStats(records) {
  const total = records.length;
  const checkIns = records.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN').length;
  const checkOuts = records.filter(r => r.entry_type === 'CHECK-OUT').length;
  const unsynced = records.filter(r => !r.synced_to_sheet).length;

  if (adminDom.statTotalPunches) adminDom.statTotalPunches.textContent = total;
  if (adminDom.statCheckIns) adminDom.statCheckIns.textContent = checkIns;
  if (adminDom.statCheckOuts) adminDom.statCheckOuts.textContent = checkOuts;
  if (adminDom.managerUnsyncedCount) adminDom.managerUnsyncedCount.textContent = unsynced;
  if (adminDom.btnSyncPendingCount) adminDom.btnSyncPendingCount.textContent = unsynced;

  if (adminDom.countAll) adminDom.countAll.textContent = total;
  if (adminDom.countCheckIn) adminDom.countCheckIn.textContent = checkIns;
  if (adminDom.countCheckOut) adminDom.countCheckOut.textContent = checkOuts;
}

// =========================================================================
// Filter & Search
// =========================================================================

function setManagerFilter(filter) {
  adminState.filter = filter;

  if (adminDom.pillFilterAll) adminDom.pillFilterAll.classList.toggle('active', filter === 'ALL');
  if (adminDom.pillFilterCheckIn) adminDom.pillFilterCheckIn.classList.toggle('active', filter === 'CHECK-IN');
  if (adminDom.pillFilterCheckOut) adminDom.pillFilterCheckOut.classList.toggle('active', filter === 'CHECK-OUT');

  applyFilters();
}

function filterManagerRecords(query) {
  adminState.searchQuery = query || '';
  applyFilters();
}

function applyFilters() {
  const q = (adminState.searchQuery || '').toLowerCase().trim();
  let filtered = adminState.records || [];

  if (adminState.filter === 'CHECK-IN') {
    filtered = filtered.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN');
  } else if (adminState.filter === 'CHECK-OUT') {
    filtered = filtered.filter(r => r.entry_type === 'CHECK-OUT');
  }

  if (q) {
    filtered = filtered.filter(r => {
      return (
        (r.worker_name && r.worker_name.toLowerCase().includes(q)) ||
        (r.worker_id && r.worker_id.toLowerCase().includes(q)) ||
        (r.purpose && r.purpose.toLowerCase().includes(q)) ||
        (r.site_name && r.site_name.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q)) ||
        (r.supervisor_name && r.supervisor_name.toLowerCase().includes(q))
      );
    });
  }

  renderRecords(filtered);
}

function renderRecords(records) {
  if (!adminDom.recordsList) return;

  if (!records || records.length === 0) {
    adminDom.recordsList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>No records found matching your filters.</p>
      </div>
    `;
    return;
  }

  adminDom.recordsList.innerHTML = records.map(rec => renderRecordCardHtml(rec)).join('');
}

function renderRecordCardHtml(rec) {
  const isCheckOut = rec.entry_type === 'CHECK-OUT';
  const typeBadgeHtml = isCheckOut
    ? `<span class="badge-checkout">🔴 Check-Out</span>`
    : `<span class="badge-checkin">🟢 Check-In</span>`;

  const photoHtml = rec.photo_url
    ? `<img src="${rec.photo_url}" class="record-thumb" alt="Photo" onclick="openPhotoModal('${rec.photo_url}', '${escapeHtml(rec.worker_name)} (${rec.entry_type || 'CHECK-IN'})', '${escapeHtml(rec.formatted_time)}')">`
    : `<div class="record-thumb-fallback">No Photo</div>`;

  const mapLinkHtml = rec.maps_url
    ? `<a href="${rec.maps_url}" target="_blank" class="record-map-link">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
           <circle cx="12" cy="10" r="3"></circle>
         </svg>
         Map Pin
       </a>`
    : `<span style="color:#94a3b8; font-size:0.7rem;">No GPS</span>`;

  const syncBadge = rec.synced_to_sheet
    ? `<span class="badge" style="background:#ecfdf5; color:#047857; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:700;">Synced</span>`
    : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:0.65rem; padding:2px 6px; border-radius:4px;">Local Sheet</span>`;

  return `
    <div class="record-card">
      <div class="record-header">
        ${photoHtml}
        <div class="record-worker-info">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
            ${typeBadgeHtml}
            <span class="record-worker-name">${escapeHtml(rec.worker_name)}</span>
          </div>
          <div class="record-worker-id">ID: <strong>${escapeHtml(rec.worker_id)}</strong></div>
          <span class="record-purpose-badge" title="${escapeHtml(rec.purpose)}">${escapeHtml(rec.purpose)}</span>
        </div>
        <div style="flex-shrink:0;">
          ${syncBadge}
        </div>
      </div>

      <div class="record-details-grid">
        <div class="record-detail-item">
          <span class="record-detail-label">Site / Location</span>
          <span class="record-detail-val" title="${escapeHtml(rec.site_name)}">${escapeHtml(rec.site_name || '--')}</span>
        </div>
        <div class="record-detail-item">
          <span class="record-detail-label">Supervisor</span>
          <span class="record-detail-val" title="${escapeHtml(rec.supervisor_name)}">${escapeHtml(rec.supervisor_name || '--')}</span>
        </div>
        ${rec.address ? `
        <div class="record-detail-item" style="grid-column: span 2;">
          <span class="record-detail-label">Address</span>
          <span class="record-detail-val" style="font-weight: 500; color: #334155;" title="${escapeHtml(rec.address)}">📍 ${escapeHtml(rec.address)}</span>
        </div>` : ''}
        ${rec.notes ? `
        <div class="record-detail-item" style="grid-column: span 2;">
          <span class="record-detail-label">Notes</span>
          <span class="record-detail-val" style="font-weight: normal; color: #475569;">${escapeHtml(rec.notes)}</span>
        </div>` : ''}
      </div>

      <div class="record-footer">
        <span class="record-time">🕒 ${escapeHtml(rec.formatted_time)}</span>
        ${mapLinkHtml}
      </div>
    </div>
  `;
}

// =========================================================================
// Google Sheet Synchronization
// =========================================================================

async function syncPendingRecords() {
  if (!adminState.token) {
    showLoginView();
    return;
  }

  if (adminDom.btnSyncNow) adminDom.btnSyncNow.disabled = true;
  showToast('Syncing records to Google Sheet...');

  try {
    const res = await fetch('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'X-Manager-Token': adminState.token }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✓ Successfully synced ${data.synced_count} records to Google Sheet!`);
      await loadAdminDashboard();
    } else {
      const errMsg = data.error || (data.errors && data.errors.length ? data.errors[0] : 'Check webhook URL or network');
      showToast('Sync incomplete: ' + errMsg, 6000);
    }
  } catch (err) {
    showToast('Error during sync: ' + err.message);
  } finally {
    if (adminDom.btnSyncNow) adminDom.btnSyncNow.disabled = false;
  }
}

// =========================================================================
// Sheet Settings Modal
// =========================================================================

function openSheetConfigModal() {
  if (adminDom.sheetConfigModal) adminDom.sheetConfigModal.style.display = 'flex';
}

function closeSheetConfigModal() {
  if (adminDom.sheetConfigModal) adminDom.sheetConfigModal.style.display = 'none';
}

async function loadSettings() {
  if (!adminState.token) return;

  try {
    const res = await fetch('/api/settings', {
      headers: { 'X-Manager-Token': adminState.token }
    });
    const data = await res.json();
    if (data.success) {
      adminState.settings = data.settings;
      if (adminDom.googleSheetUrlInput) adminDom.googleSheetUrlInput.value = data.settings.google_sheet_url || '';
      if (adminDom.googleWebhookInput) adminDom.googleWebhookInput.value = data.settings.google_sheet_webhook_url || '';

      const sheetUrl = data.settings.google_sheet_url || 'https://docs.google.com/spreadsheets/d/126zQm54eFZyDvKWlUvi1efvorLNP5l_cfibAiespP6s/edit?usp=sharing';
      if (adminDom.currentSheetDisplay) adminDom.currentSheetDisplay.textContent = sheetUrl;
      if (adminDom.btnOpenGoogleSheet) adminDom.btnOpenGoogleSheet.href = sheetUrl;

      if (adminDom.managerUnsyncedCount) {
        adminDom.managerUnsyncedCount.textContent = data.stats.unsynced_records;
      }
      if (adminDom.btnSyncPendingCount) {
        adminDom.btnSyncPendingCount.textContent = data.stats.unsynced_records;
      }
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function updateSheetOpenLink() {
  const url = adminDom.googleSheetUrlInput?.value.trim();
  if (url && adminDom.btnOpenGoogleSheet && adminDom.currentSheetDisplay) {
    adminDom.btnOpenGoogleSheet.href = url;
    adminDom.currentSheetDisplay.textContent = url;
  }
}

async function saveSheetSettings(event) {
  if (event) event.preventDefault();
  if (!adminState.token) {
    showLoginView();
    return;
  }

  const google_sheet_url = adminDom.googleSheetUrlInput ? adminDom.googleSheetUrlInput.value.trim() : '';
  const google_sheet_webhook_url = adminDom.googleWebhookInput ? adminDom.googleWebhookInput.value.trim() : '';
  const google_service_account_json = adminDom.serviceAccountJsonInput ? adminDom.serviceAccountJsonInput.value.trim() : undefined;

  try {
    const payload = { google_sheet_url, google_sheet_webhook_url };
    if (google_service_account_json) payload.google_service_account_json = google_service_account_json;

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-Token': adminState.token
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Google Sheet settings saved successfully!');
      closeSheetConfigModal();
      loadSettings();
    } else {
      showToast('Error saving settings: ' + data.error);
    }
  } catch (err) {
    showToast('Network error saving settings');
  }
}

async function testSheetWebhook() {
  if (!adminState.token) {
    showLoginView();
    return;
  }

  const webhook_url = adminDom.googleWebhookInput ? adminDom.googleWebhookInput.value.trim() : '';
  if (!webhook_url) {
    showToast('Please paste a Webhook URL first');
    return;
  }

  showToast('Sending test ping to Google Sheet...', 4000);
  try {
    const res = await fetch('/api/test-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-Token': adminState.token
      },
      body: JSON.stringify({ webhook_url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Connection successful! Test row appended to Google Sheet.', 5000);
      loadSettings();
      loadAdminDashboard();
    } else {
      showToast('Connection failed: ' + (data.error || 'Check Webhook URL & permissions'), 7000);
    }
  } catch (err) {
    showToast('Network error testing webhook: ' + err.message);
  }
}

async function testServiceAccountConnection() {
  if (!adminState.token) return;
  const json = adminDom.serviceAccountJsonInput ? adminDom.serviceAccountJsonInput.value.trim() : '';
  if (!json) {
    showToast('Please paste Service Account JSON first');
    return;
  }

  showToast('Testing direct Google Sheets API connection...');
  try {
    const res = await fetch('/api/test-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-Token': adminState.token
      },
      body: JSON.stringify({ method: 'service_account', credentials_json: json })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Direct API Connected! Test row written to Google Sheet.', 5000);
    } else {
      showToast('Direct API failed: ' + data.error, 6000);
    }
  } catch (err) {
    showToast('Network error testing direct API: ' + err.message);
  }
}

function copyAppsScriptCode() {
  const codeEl = document.getElementById('appsScriptSnippet');
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.innerText).then(() => {
    showToast('✓ Google Apps Script copied to clipboard!');
  }).catch(() => {
    showToast('Could not auto-copy. Please select and copy manually.');
  });
}

// =========================================================================
// Change Password Modal
// =========================================================================

function openChangePasswordModal() {
  if (adminDom.changePasswordError) adminDom.changePasswordError.style.display = 'none';
  if (adminDom.inputCurrentPassword) adminDom.inputCurrentPassword.value = '';
  if (adminDom.inputNewPassword) adminDom.inputNewPassword.value = '';
  if (adminDom.inputConfirmNewPassword) adminDom.inputConfirmNewPassword.value = '';
  if (adminDom.changePasswordModal) adminDom.changePasswordModal.style.display = 'flex';
}

function closeChangePasswordModal() {
  if (adminDom.changePasswordModal) adminDom.changePasswordModal.style.display = 'none';
}

async function submitChangePassword(event) {
  if (event) event.preventDefault();
  const current_password = adminDom.inputCurrentPassword ? adminDom.inputCurrentPassword.value.trim() : '';
  const new_password = adminDom.inputNewPassword ? adminDom.inputNewPassword.value.trim() : '';
  const confirm_password = adminDom.inputConfirmNewPassword ? adminDom.inputConfirmNewPassword.value.trim() : '';

  if (new_password.length < 6) {
    showChangePasswordError('New password must be at least 6 characters.');
    return;
  }
  if (new_password !== confirm_password) {
    showChangePasswordError('New passwords do not match. Please re-enter.');
    return;
  }

  try {
    const res = await fetch('/api/change-manager-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-Token': adminState.token
      },
      body: JSON.stringify({ current_password, new_password })
    });
    const data = await res.json();
    if (data.success) {
      if (data.token) {
        // Update stored token with new token
        const wasRemembered = !!localStorage.getItem(STORAGE_TOKEN_KEY);
        saveToken(data.token, wasRemembered);
      }
      closeChangePasswordModal();
      showToast('✓ Manager password updated successfully!');
      updateCsvExportLink();
    } else {
      showChangePasswordError(data.error || 'Failed to update password.');
    }
  } catch (err) {
    showChangePasswordError('Network error updating password. Please retry.');
  }
}

function showChangePasswordError(msg) {
  if (adminDom.changePasswordError) {
    adminDom.changePasswordError.textContent = msg;
    adminDom.changePasswordError.style.display = 'block';
  }
}

// =========================================================================
// UI Helpers: Eye Toggle, Toast, Photo Zoom, Modal Dismiss
// =========================================================================

function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

function showToast(message, duration = 3500) {
  if (!adminDom.toast) return;
  adminDom.toast.textContent = message;
  adminDom.toast.style.display = 'block';
  adminDom.toast.classList.add('show');

  setTimeout(() => {
    adminDom.toast.classList.remove('show');
    setTimeout(() => {
      adminDom.toast.style.display = 'none';
    }, 300);
  }, duration);
}

function openPhotoModal(url, title, time) {
  if (!adminDom.photoModal) return;
  adminDom.fullPhotoImg.src = url;
  adminDom.photoModalMeta.textContent = `${title} • ${time}`;
  adminDom.photoModal.style.display = 'flex';
}

function closePhotoModal() {
  if (adminDom.photoModal) {
    adminDom.photoModal.style.display = 'none';
    adminDom.fullPhotoImg.src = '';
  }
}

function handleModalBackdropClick(e) {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.style.display = 'none';
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}