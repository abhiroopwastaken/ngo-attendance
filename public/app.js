/**
 * NGO Field Worker Attendance Web App
 * Smartphone-optimized, GPS, Camera (Native + Live), Check-In / Check-Out,
 * Reverse Geocoding (Readable Address & Auto-fill Site) & Sheet Export
 */

// Application State
const state = {
  currentPunchType: 'CHECK-IN', // 'CHECK-IN' or 'CHECK-OUT'
  recordFilter: 'ALL', // 'ALL', 'CHECK-IN', 'CHECK-OUT' (for worker)
  workerDutyStatus: null,
  currentGps: null, // { latitude, longitude, accuracy, isManual, address, locality }
  capturedPhotoBase64: null,
  cameraStream: null,
  currentFacingMode: 'environment', // 'environment' (back) or 'user' (front)
  workerRecords: [], // Only current worker's punches
  managerRecords: [], // All workers' punches (Manager only)
  managerFilter: 'ALL', // 'ALL', 'CHECK-IN', 'CHECK-OUT' (for manager)
  managerPin: sessionStorage.getItem('ngo_manager_pin') || null,
  settings: {},
  clockInterval: null,
  networkInfo: null,
  siteNameManuallyEdited: false
};

// DOM Elements
const dom = {
  // Top Banner
  httpsNoticeBanner: document.getElementById('httpsNoticeBanner'),
  btnSwitchHttps: document.getElementById('btnSwitchHttps'),

  // Header & Clock
  headerClock: document.getElementById('headerClock'),
  liveTimestampDisplay: document.getElementById('liveTimestampDisplay'),
  btnOpenManagerPortal: document.getElementById('btnOpenManagerPortal'),

  // Punch Mode (Check-In vs Check-Out)
  btnSelectCheckIn: document.getElementById('btnSelectCheckIn'),
  btnSelectCheckOut: document.getElementById('btnSelectCheckOut'),
  currentDutyBadge: document.getElementById('currentDutyBadge'),
  activeCheckInBanner: document.getElementById('activeCheckInBanner'),
  activeCheckInSite: document.getElementById('activeCheckInSite'),
  activeCheckInTime: document.getElementById('activeCheckInTime'),

  // GPS & Address
  gpsDot: document.getElementById('gpsDot'),
  gpsStatusText: document.getElementById('gpsStatusText'),
  gpsAddressBox: document.getElementById('gpsAddressBox'),
  gpsAddressText: document.getElementById('gpsAddressText'),
  gpsCoordsText: document.getElementById('gpsCoordsText'),
  btnRefreshGps: document.getElementById('btnRefreshGps'),
  gpsHelpContainer: document.getElementById('gpsHelpContainer'),
  gpsHelpMessage: document.getElementById('gpsHelpMessage'),
  gpsHttpsLink: document.getElementById('gpsHttpsLink'),
  btnToggleManualCoords: document.getElementById('btnToggleManualCoords'),
  manualCoordsFields: document.getElementById('manualCoordsFields'),
  manualLatInput: document.getElementById('manualLatInput'),
  manualLngInput: document.getElementById('manualLngInput'),

  // Camera
  cameraViewport: document.getElementById('cameraViewport'),
  cameraVideo: document.getElementById('cameraVideo'),
  cameraCanvas: document.getElementById('cameraCanvas'),
  photoPreviewImg: document.getElementById('photoPreviewImg'),
  photoWatermark: document.getElementById('photoWatermark'),
  watermarkTime: document.getElementById('watermarkTime'),
  watermarkCoords: document.getElementById('watermarkCoords'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  cameraInitGroup: document.getElementById('cameraInitGroup'),
  cameraLiveControls: document.getElementById('cameraLiveControls'),
  cameraRetakeGroup: document.getElementById('cameraRetakeGroup'),
  photoStatusBadge: document.getElementById('photoStatusBadge'),
  cameraInput: document.getElementById('cameraInput'),
  galleryInput: document.getElementById('galleryInput'),
  btnLiveCamera: document.getElementById('btnLiveCamera'),

  // Form
  form: document.getElementById('attendanceForm'),
  workerName: document.getElementById('workerName'),
  workerId: document.getElementById('workerId'),
  purposeLabel: document.getElementById('purposeLabel'),
  purposeInput: document.getElementById('purposeInput'),
  siteName: document.getElementById('siteName'),
  siteAutoTag: document.getElementById('siteAutoTag'),
  supervisorName: document.getElementById('supervisorName'),
  supervisorContact: document.getElementById('supervisorContact'),
  notesInput: document.getElementById('notesInput'),
  rememberMeCheck: document.getElementById('rememberMeCheck'),
  submitBtn: document.getElementById('submitBtn'),
  submitBtnText: document.getElementById('submitBtnText'),

  // Tabs
  sectionMark: document.getElementById('sectionMark'),
  sectionRecords: document.getElementById('sectionRecords'),
  tabMarkBtn: document.getElementById('tabMarkBtn'),
  tabRecordsBtn: document.getElementById('tabRecordsBtn'),
  recordsCountBadge: document.getElementById('recordsCountBadge'),

  // Worker Personal History UI
  workerIdentityBanner: document.getElementById('workerIdentityBanner'),
  displayWorkerIdBadge: document.getElementById('displayWorkerIdBadge'),
  workerIdMissingNotice: document.getElementById('workerIdMissingNotice'),
  workerFilterPills: document.getElementById('workerFilterPills'),
  workerHistorySubtitle: document.getElementById('workerHistorySubtitle'),
  recordsList: document.getElementById('recordsList'),
  pillFilterAll: document.getElementById('pillFilterAll'),
  pillFilterCheckIn: document.getElementById('pillFilterCheckIn'),
  pillFilterCheckOut: document.getElementById('pillFilterCheckOut'),
  countAllPill: document.getElementById('countAllPill'),
  countCheckInPill: document.getElementById('countCheckInPill'),
  countCheckOutPill: document.getElementById('countCheckOutPill'),

  // Manager Portal UI
  managerPinModal: document.getElementById('managerPinModal'),
  managerPinForm: document.getElementById('managerPinForm'),
  managerPinInput: document.getElementById('managerPinInput'),
  pinErrorMessage: document.getElementById('pinErrorMessage'),
  managerDashboardModal: document.getElementById('managerDashboardModal'),
  managerRecordsList: document.getElementById('managerRecordsList'),
  managerSearchInput: document.getElementById('managerSearchInput'),
  btnManagerExportCsv: document.getElementById('btnManagerExportCsv'),
  statTotalPunches: document.getElementById('statTotalPunches'),
  statCheckIns: document.getElementById('statCheckIns'),
  statCheckOuts: document.getElementById('statCheckOuts'),
  managerUnsyncedCount: document.getElementById('managerUnsyncedCount'),
  pillManagerFilterAll: document.getElementById('pillManagerFilterAll'),
  pillManagerFilterCheckIn: document.getElementById('pillManagerFilterCheckIn'),
  pillManagerFilterCheckOut: document.getElementById('pillManagerFilterCheckOut'),
  countManagerAll: document.getElementById('countManagerAll'),
  countManagerCheckIn: document.getElementById('countManagerCheckIn'),
  countManagerCheckOut: document.getElementById('countManagerCheckOut'),

  // Change PIN Modal
  changePinModal: document.getElementById('changePinModal'),
  inputCurrentPin: document.getElementById('inputCurrentPin'),
  inputNewPin: document.getElementById('inputNewPin'),
  inputConfirmNewPin: document.getElementById('inputConfirmNewPin'),

  // Google Sheet & Config Modals
  googleSheetBadge: document.getElementById('googleSheetBadge'),
  unsyncedCountText: document.getElementById('unsyncedCountText'),
  btnSyncNow: document.getElementById('btnSyncNow'),
  sheetConfigModal: document.getElementById('sheetConfigModal'),
  googleSheetUrlInput: document.getElementById('googleSheetUrlInput'),
  googleWebhookInput: document.getElementById('googleWebhookInput'),
  currentSheetDisplay: document.getElementById('currentSheetDisplay'),
  btnOpenGoogleSheet: document.getElementById('btnOpenGoogleSheet'),
  serviceAccountJsonInput: document.getElementById('serviceAccountJsonInput'),
  successModal: document.getElementById('successModal'),
  successDetails: document.getElementById('successDetails'),
  photoModal: document.getElementById('photoModal'),
  fullPhotoImg: document.getElementById('fullPhotoImg'),
  photoModalMeta: document.getElementById('photoModalMeta'),
  toast: document.getElementById('toast')
};

// =========================================================================
// Initialization
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();
  checkSecurityContext();
  loadSavedWorkerDetails();
  refreshGpsLocation();
  loadWorkerHistory();

  if (dom.workerId) {
    dom.workerId.addEventListener('input', () => {
      checkWorkerDutyStatus();
      if (dom.sectionRecords && dom.sectionRecords.style.display !== 'none') {
        loadWorkerHistory();
      }
    });
    dom.workerId.addEventListener('change', () => {
      checkWorkerDutyStatus();
      loadWorkerHistory();
    });
    dom.workerId.addEventListener('blur', () => {
      checkWorkerDutyStatus();
    });
  }

  // Detect if user manually edits site name
  if (dom.siteName) {
    dom.siteName.addEventListener('input', () => {
      state.siteNameManuallyEdited = true;
      if (dom.siteAutoTag) dom.siteAutoTag.style.display = 'none';
    });
  }
});

// =========================================================================
// Check-In vs Check-Out Management
// =========================================================================

function setPunchType(type) {
  state.currentPunchType = type;

  if (type === 'CHECK-IN') {
    dom.btnSelectCheckIn.classList.add('active');
    dom.btnSelectCheckOut.classList.remove('active');

    dom.submitBtn.classList.remove('btn-checkout');
    dom.submitBtn.classList.add('btn-checkin');
    dom.submitBtnText.textContent = 'PUNCH CHECK-IN';

    // Update labels & placeholders for Check-In
    document.querySelector('.photo-card .card-title').textContent = 'Field Photograph (Check-In) *';
    dom.purposeLabel.textContent = 'Purpose of Visit / Duty *';
    dom.purposeInput.placeholder = 'e.g. Beneficiary Survey, Relief Distribution, Site Inspection';
    document.querySelector('label[for="notesInput"]').textContent = 'Field Notes / Check-In Plan (Optional)';
    dom.notesInput.placeholder = 'e.g. Distributed 45 ration kits; surveyed 12 families';
  } else {
    dom.btnSelectCheckIn.classList.remove('active');
    dom.btnSelectCheckOut.classList.add('active');

    dom.submitBtn.classList.remove('btn-checkin');
    dom.submitBtn.classList.add('btn-checkout');
    dom.submitBtnText.textContent = 'PUNCH CHECK-OUT';

    // Update labels & placeholders for Check-Out
    document.querySelector('.photo-card .card-title').textContent = 'Field Photograph (Check-Out) *';
    dom.purposeLabel.textContent = 'Work / Activity Completed *';
    dom.purposeInput.placeholder = 'e.g. Completed 15 household surveys, distributed 40 kits, concluded visit';
    document.querySelector('label[for="notesInput"]').textContent = 'Departure Notes / Summary of Work (Optional)';
    dom.notesInput.placeholder = 'e.g. Concluded field visit; all supplies handed over.';

    // If active check-in site exists, auto-fill it
    if (state.workerDutyStatus && state.workerDutyStatus.latest_record) {
      if (!dom.siteName.value.trim()) {
        dom.siteName.value = state.workerDutyStatus.latest_record.site_name || '';
      }
      if (!dom.supervisorName.value.trim()) {
        dom.supervisorName.value = state.workerDutyStatus.latest_record.supervisor_name || '';
      }
      if (!dom.supervisorContact.value.trim()) {
        dom.supervisorContact.value = state.workerDutyStatus.latest_record.supervisor_contact || '';
      }
    }
  }

  vibrateDevice([30]);
}

async function checkWorkerDutyStatus() {
  const workerId = dom.workerId ? dom.workerId.value.trim() : '';
  if (!workerId) {
    if (dom.currentDutyBadge) {
      dom.currentDutyBadge.textContent = 'Not Checked In';
      dom.currentDutyBadge.className = 'current-duty-badge';
    }
    if (dom.activeCheckInBanner) dom.activeCheckInBanner.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`/api/worker-status?worker_id=${encodeURIComponent(workerId)}`);
    const data = await res.json();

    if (data.success && data.has_record) {
      state.workerDutyStatus = data;
      const latest = data.latest_record;

      if (data.status === 'CHECK-IN') {
        dom.currentDutyBadge.textContent = '🟢 Currently Checked In';
        dom.currentDutyBadge.className = 'current-duty-badge checked-in';

        if (dom.activeCheckInBanner) {
          dom.activeCheckInSite.textContent = `Active Site: ${latest.site_name || 'Field Site'}`;
          dom.activeCheckInTime.textContent = `Checked in at ${latest.formatted_time}`;
          dom.activeCheckInBanner.style.display = 'flex';
        }
      } else {
        dom.currentDutyBadge.textContent = '⚪ Off Duty (Checked Out)';
        dom.currentDutyBadge.className = 'current-duty-badge checked-out';
        if (dom.activeCheckInBanner) dom.activeCheckInBanner.style.display = 'none';
      }
    } else {
      state.workerDutyStatus = null;
      dom.currentDutyBadge.textContent = '⚪ Ready for Duty';
      dom.currentDutyBadge.className = 'current-duty-badge';
      if (dom.activeCheckInBanner) dom.activeCheckInBanner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to check worker status:', err);
  }
}

// =========================================================================
// Security Context & Mobile Permissions Detection
// =========================================================================

async function checkSecurityContext() {
  const isHttps = location.protocol === 'https:';
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  try {
    const res = await fetch('/api/network-info');
    state.networkInfo = await res.json();
  } catch (e) {}

  const targetHttpsPort = (state.networkInfo && state.networkInfo.https_port) || 3443;
  const httpsUrl = `https://${location.hostname}:${targetHttpsPort}${location.pathname}`;

  if (dom.btnSwitchHttps) dom.btnSwitchHttps.href = httpsUrl;
  if (dom.gpsHttpsLink) dom.gpsHttpsLink.href = httpsUrl;

  if (!isHttps && !isLocalhost) {
    if (dom.httpsNoticeBanner) dom.httpsNoticeBanner.style.display = 'block';
  } else {
    if (dom.httpsNoticeBanner) dom.httpsNoticeBanner.style.display = 'none';
  }
}

// =========================================================================
// Clock & Timestamp
// =========================================================================

function startLiveClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateStr = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (dom.headerClock) dom.headerClock.textContent = timeStr;
    if (dom.liveTimestampDisplay) {
      dom.liveTimestampDisplay.textContent = `${fullDateStr} • ${timeStr}`;
    }
  };

  updateClock();
  state.clockInterval = setInterval(updateClock, 1000);
}

// =========================================================================
// Reverse Geocoding: Resolves Readable Address & Auto-fills Site Name
// =========================================================================

async function reverseGeocodeCoordinates(lat, lng) {
  if (dom.gpsAddressBox) {
    dom.gpsAddressBox.style.display = 'flex';
    dom.gpsAddressText.textContent = 'Resolving address...';
  }

  let result = null;

  // 1. Try OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && (data.display_name || data.address)) {
        const addr = data.address || {};
        const locality = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || addr.town || addr.city_district || addr.city || addr.county || '';
        const fullAddress = data.display_name || '';
        result = {
          fullAddress,
          locality: locality || fullAddress.split(',')[0].trim()
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error:', err.message);
  }

  // 2. Fallback: BigDataCloud client API
  if (!result) {
    try {
      const res2 = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
      if (res2.ok) {
        const data2 = await res2.json();
        const parts = [
          data2.locality || data2.city,
          data2.principalSubdivision,
          data2.countryName
        ].filter(Boolean);
        const fullAddress = parts.join(', ');
        const locality = data2.locality || data2.city || data2.principalSubdivision || '';
        if (fullAddress) {
          result = { fullAddress, locality };
        }
      }
    } catch (err2) {
      console.warn('BigDataCloud reverse geocode error:', err2.message);
    }
  }

  // Apply result to State and UI
  if (result && state.currentGps) {
    state.currentGps.address = result.fullAddress;
    state.currentGps.locality = result.locality;

    if (dom.gpsAddressText) {
      dom.gpsAddressText.textContent = result.fullAddress;
      dom.gpsAddressBox.style.display = 'flex';
    }

    // Auto-fill Village / Site / Location Name if worker hasn't manually edited it
    if (!state.siteNameManuallyEdited || !dom.siteName.value.trim()) {
      const autoSite = result.locality || result.fullAddress.split(',')[0].trim();
      if (autoSite) {
        dom.siteName.value = autoSite;
        if (dom.siteAutoTag) dom.siteAutoTag.style.display = 'inline-block';
      }
    }
  } else {
    if (dom.gpsAddressText) {
      dom.gpsAddressText.textContent = `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }
}

// =========================================================================
// Geolocation Handling
// =========================================================================

function refreshGpsLocation() {
  const isHttps = location.protocol === 'https:';
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (!navigator.geolocation) {
    setGpsStatus('error', 'Geolocation is not supported by your browser', null);
    showGpsHelp('Browser does not support GPS.');
    return;
  }

  setGpsStatus('waiting', 'Acquiring GPS location...', null);

  const options = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 5000
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      state.currentGps = { latitude, longitude, accuracy, isManual: false, address: '', locality: '' };
      const accRounded = Math.round(accuracy);
      setGpsStatus('locked', `GPS Locked (Accuracy: ±${accRounded}m)`, { latitude, longitude, accuracy });
      hideGpsHelp();

      // Reverse geocode to get readable address & auto-fill village/site
      reverseGeocodeCoordinates(latitude, longitude);
    },
    (error) => {
      let msg = 'Could not get GPS fix';
      let helpMsg = '';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          if (!isHttps && !isLocalhost) {
            msg = 'GPS blocked by browser security (HTTP)';
            helpMsg = 'Mobile browsers strictly block GPS over plain HTTP. Tap "Switch to HTTPS" above for auto-GPS, or enter coordinates manually.';
            if (dom.gpsHttpsLink) dom.gpsHttpsLink.style.display = 'inline-block';
          } else {
            msg = 'Location permission denied';
            helpMsg = 'Location permission was denied. Check your browser URL bar or phone Settings to allow Location for this site.';
            if (dom.gpsHttpsLink) dom.gpsHttpsLink.style.display = 'none';
          }
          break;
        case error.POSITION_UNAVAILABLE:
          msg = 'Location signal unavailable';
          helpMsg = 'Ensure your device Location / GPS toggle is turned ON in phone settings.';
          break;
        case error.TIMEOUT:
          msg = 'GPS request timed out';
          helpMsg = 'GPS satellite signal is taking long. You can retry or enter site coordinates manually.';
          break;
      }

      setGpsStatus('error', msg, null);
      showGpsHelp(helpMsg);
    },
    options
  );
}

function setGpsStatus(type, text, coords) {
  if (dom.gpsDot) dom.gpsDot.className = `gps-dot ${type}`;
  if (dom.gpsStatusText) dom.gpsStatusText.textContent = text;
  if (dom.gpsCoordsText) {
    if (coords) {
      const lat = coords.latitude.toFixed(5);
      const lng = coords.longitude.toFixed(5);
      dom.gpsCoordsText.innerHTML = `Lat: <strong>${lat}</strong> | Lng: <strong>${lng}</strong>`;
    } else {
      dom.gpsCoordsText.textContent = 'Lat: -- | Lng: --';
    }
  }
}

function showGpsHelp(message) {
  if (dom.gpsHelpContainer) {
    dom.gpsHelpMessage.textContent = message;
    dom.gpsHelpContainer.style.display = 'block';
  }
}

function hideGpsHelp() {
  if (dom.gpsHelpContainer && (!state.currentGps || !state.currentGps.isManual)) {
    dom.gpsHelpContainer.style.display = 'none';
  }
}

function toggleManualCoordinates() {
  const isHidden = dom.manualCoordsFields.style.display === 'none';
  dom.manualCoordsFields.style.display = isHidden ? 'block' : 'none';
  dom.btnToggleManualCoords.textContent = isHidden ? 'Hide Manual Coords' : 'Enter Coords Manually';

  if (isHidden) {
    dom.manualLatInput.focus();
  }
}

function handleManualCoordsChange() {
  const lat = parseFloat(dom.manualLatInput.value);
  const lng = parseFloat(dom.manualLngInput.value);

  if (!isNaN(lat) && !isNaN(lng)) {
    state.currentGps = {
      latitude: lat,
      longitude: lng,
      accuracy: 0,
      isManual: true,
      address: '',
      locality: ''
    };
    setGpsStatus('locked', 'Manual Coordinates Set ✓', { latitude: lat, longitude: lng });
    reverseGeocodeCoordinates(lat, lng);
  }
}

// =========================================================================
// Camera & Photo Capture
// =========================================================================

async function startLiveCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Live viewfinder requires HTTPS on phones. Opening native phone camera...');
    dom.cameraInput.click();
    return;
  }

  try {
    stopLiveCamera();

    const constraints = {
      audio: false,
      video: {
        facingMode: state.currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.cameraStream = stream;

    dom.cameraVideo.srcObject = stream;
    dom.cameraVideo.style.display = 'block';
    dom.photoPreviewImg.style.display = 'none';
    dom.cameraPlaceholder.style.display = 'none';
    dom.photoWatermark.style.display = 'none';

    dom.cameraInitGroup.style.display = 'none';
    dom.cameraLiveControls.style.display = 'flex';
    dom.cameraRetakeGroup.style.display = 'none';
  } catch (err) {
    console.error('Camera stream error:', err);
    showToast('Could not open live stream. Opening phone camera app...');
    dom.cameraInput.click();
  }
}

function stopLiveCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  if (dom.cameraVideo) {
    dom.cameraVideo.srcObject = null;
    dom.cameraVideo.style.display = 'none';
  }
  if (dom.cameraLiveControls) {
    dom.cameraLiveControls.style.display = 'none';
  }
  if (!state.capturedPhotoBase64) {
    dom.cameraPlaceholder.style.display = 'flex';
    dom.cameraInitGroup.style.display = 'flex';
  }
}

function switchCameraFacing() {
  state.currentFacingMode = state.currentFacingMode === 'environment' ? 'user' : 'environment';
  startLiveCamera();
}

function captureSnapshot() {
  if (!state.cameraStream) return;

  const video = dom.cameraVideo;
  const canvas = dom.cameraCanvas;
  const ctx = canvas.getContext('2d');

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  const MAX_DIM = 1280;
  let targetW = width;
  let targetH = height;

  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    if (targetW > targetH) {
      targetH = Math.round((targetH * MAX_DIM) / targetW);
      targetW = MAX_DIM;
    } else {
      targetW = Math.round((targetW * MAX_DIM) / targetH);
      targetH = MAX_DIM;
    }
  }

  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(video, 0, 0, targetW, targetH);

  stampWatermarkOnCanvas(ctx, targetW, targetH);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  applyCapturedPhoto(dataUrl);

  stopLiveCamera();
  vibrateDevice([40]);
}

function handleFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = dom.cameraCanvas;
      const ctx = canvas.getContext('2d');

      const MAX_DIM = 1280;
      let targetW = img.width;
      let targetH = img.height;

      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      stampWatermarkOnCanvas(ctx, targetW, targetH);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      applyCapturedPhoto(compressedDataUrl);
      vibrateDevice([40]);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function stampWatermarkOnCanvas(ctx, width, height) {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const typeTag = state.currentPunchType === 'CHECK-OUT' ? '[CHECK-OUT]' : '[CHECK-IN]';

  let locStr = 'GPS: Not Captured';
  if (state.currentGps) {
    const { latitude, longitude, address, locality } = state.currentGps;
    const place = locality || (address ? address.split(',')[0].trim() : '');
    locStr = place
      ? `📍 ${place} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      : `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  const barHeight = Math.max(50, Math.round(height * 0.085));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  // Time and Punch Type
  ctx.fillStyle = state.currentPunchType === 'CHECK-OUT' ? '#f87171' : '#4ade80';
  ctx.font = `bold ${Math.max(14, Math.round(barHeight * 0.28))}px sans-serif`;
  ctx.fillText(`🕒 ${timeStr} • ${typeTag}`, 14, height - barHeight + (barHeight * 0.42));

  // Readable Locality & Coordinates
  ctx.fillStyle = '#38bdf8';
  ctx.font = `${Math.max(12, Math.round(barHeight * 0.25))}px monospace`;
  ctx.fillText(locStr, 14, height - (barHeight * 0.2));
}

function applyCapturedPhoto(dataUrl) {
  state.capturedPhotoBase64 = dataUrl;

  dom.photoPreviewImg.src = dataUrl;
  dom.photoPreviewImg.style.display = 'block';
  dom.cameraPlaceholder.style.display = 'none';
  if (dom.cameraVideo) dom.cameraVideo.style.display = 'none';

  dom.cameraInitGroup.style.display = 'none';
  if (dom.cameraLiveControls) dom.cameraLiveControls.style.display = 'none';
  dom.cameraRetakeGroup.style.display = 'flex';

  dom.photoStatusBadge.textContent = 'Photo Captured ✓';
  dom.photoStatusBadge.className = 'card-badge badge-success';
}

function retakePhoto() {
  state.capturedPhotoBase64 = null;
  dom.photoPreviewImg.src = '';
  dom.photoPreviewImg.style.display = 'none';
  dom.photoWatermark.style.display = 'none';
  dom.cameraPlaceholder.style.display = 'flex';
  dom.cameraRetakeGroup.style.display = 'none';
  dom.cameraInitGroup.style.display = 'flex';
  dom.cameraInput.value = '';
  dom.galleryInput.value = '';

  dom.photoStatusBadge.textContent = 'Photo Required';
  dom.photoStatusBadge.className = 'card-badge';
}

// =========================================================================
// Form & User Persistence
// =========================================================================

function loadSavedWorkerDetails() {
  try {
    const saved = localStorage.getItem('ngo_worker_profile');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.workerName) dom.workerName.value = data.workerName;
      if (data.workerId) {
        dom.workerId.value = data.workerId;
        checkWorkerDutyStatus();
      }
      if (data.supervisorName) dom.supervisorName.value = data.supervisorName;
      if (data.supervisorContact) dom.supervisorContact.value = data.supervisorContact;
    }
  } catch (e) {}
}

function saveWorkerDetailsIfChecked() {
  if (dom.rememberMeCheck && dom.rememberMeCheck.checked) {
    const profile = {
      workerName: dom.workerName.value.trim(),
      workerId: dom.workerId.value.trim(),
      supervisorName: dom.supervisorName.value.trim(),
      supervisorContact: dom.supervisorContact.value.trim()
    };
    try {
      localStorage.setItem('ngo_worker_profile', JSON.stringify(profile));
    } catch (e) {}
  }
}

// =========================================================================
// Submit Attendance Check-In / Check-Out
// =========================================================================

async function handleAttendanceSubmit(event) {
  event.preventDefault();

  if (!state.capturedPhotoBase64) {
    showToast('Please capture a field photograph first!');
    dom.cameraViewport.scrollIntoView({ behavior: 'smooth', block: 'center' });
    vibrateDevice([100, 50, 100]);
    return;
  }

  const purpose = dom.purposeInput.value.trim();
  if (!purpose) {
    showToast('Please enter the purpose of visit or activity completed.');
    dom.purposeInput.focus();
    return;
  }

  const isCheckOut = state.currentPunchType === 'CHECK-OUT';
  dom.submitBtn.disabled = true;
  dom.submitBtnText.textContent = isCheckOut ? 'RECORDING CHECK-OUT...' : 'RECORDING CHECK-IN...';

  saveWorkerDetailsIfChecked();

  const payload = {
    entry_type: state.currentPunchType,
    worker_name: dom.workerName.value.trim(),
    worker_id: dom.workerId.value.trim(),
    purpose: purpose,
    site_name: dom.siteName.value.trim(),
    address: state.currentGps ? (state.currentGps.address || '') : '',
    supervisor_name: dom.supervisorName.value.trim(),
    supervisor_contact: dom.supervisorContact.value.trim(),
    notes: dom.notesInput.value.trim(),
    latitude: state.currentGps ? state.currentGps.latitude : null,
    longitude: state.currentGps ? state.currentGps.longitude : null,
    accuracy: state.currentGps ? state.currentGps.accuracy : null,
    photo_base64: state.capturedPhotoBase64,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let result;
    const resText = await res.text();
    try {
      result = JSON.parse(resText);
    } catch (parseErr) {
      console.error('Non-JSON response from server:', res.status, resText);
      showToast(`Server error (${res.status}): ${resText.slice(0, 120) || 'Check server logs'}`);
      return;
    }

    if (result.success) {
      vibrateDevice([50, 50, 150]);
      showSuccessModal(result.record);
      checkWorkerDutyStatus();
      loadWorkerHistory();
      if (state.managerPin) loadSettings();
    } else {
      showToast('Error: ' + (result.error || 'Failed to record attendance'));
    }
  } catch (err) {
    console.error('Submission error:', err);
    showToast('Network error: ' + (err.message || 'Could not connect to server'));
  } finally {
    dom.submitBtn.disabled = false;
    dom.submitBtnText.textContent = isCheckOut ? 'PUNCH CHECK-OUT' : 'PUNCH CHECK-IN';
  }
}

function showSuccessModal(record) {
  const isCheckOut = record.entry_type === 'CHECK-OUT';
  const typeBadgeHtml = isCheckOut
    ? `<span class="badge-checkout">🔴 Check-Out (Departure)</span>`
    : `<span class="badge-checkin">🟢 Check-In (Arrival)</span>`;

  const mapsLinkHtml = record.maps_url
    ? `<a href="${record.maps_url}" target="_blank" style="color:var(--info); font-weight:600;">View GPS Location on Google Maps ↗</a>`
    : '<span style="color:#94a3b8;">GPS not available</span>';

  const syncStatusHtml = record.synced_to_sheet
    ? '<span style="color:var(--primary); font-weight:700;">Synced to Google Sheet ✓</span>'
    : '<span style="color:#64748b;">Logged in Local Sheet (Ready to sync)</span>';

  document.getElementById('successSubtitle').textContent = isCheckOut
    ? 'Your Check-Out (Departure) has been successfully recorded.'
    : 'Your Check-In (Arrival) has been successfully recorded.';

  dom.successDetails.innerHTML = `
    <div style="margin-bottom:4px;"><strong>Action:</strong> ${typeBadgeHtml}</div>
    <div><strong>Field Worker:</strong> ${escapeHtml(record.worker_name)} (${escapeHtml(record.worker_id)})</div>
    <div><strong>Purpose / Activity:</strong> ${escapeHtml(record.purpose)}</div>
    <div><strong>Site / Village:</strong> ${escapeHtml(record.site_name)}</div>
    ${record.address ? `<div><strong>Readable Address:</strong> ${escapeHtml(record.address)}</div>` : ''}
    <div><strong>Supervisor:</strong> ${escapeHtml(record.supervisor_name)}</div>
    <div><strong>Timestamp:</strong> ${escapeHtml(record.formatted_time)}</div>
    <div><strong>Location:</strong> ${mapsLinkHtml}</div>
    <div style="margin-top:4px; padding-top:4px; border-top:1px solid #e2e8f0;">
      <strong>Spreadsheet Status:</strong> ${syncStatusHtml}
    </div>
  `;

  dom.successModal.style.display = 'flex';
}

function closeSuccessModalAndReset() {
  dom.successModal.style.display = 'none';
  dom.purposeInput.value = '';
  dom.notesInput.value = '';
  state.siteNameManuallyEdited = false;
  retakePhoto();
  refreshGpsLocation();
  checkWorkerDutyStatus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSuccessModalAndGoToRecords() {
  closeSuccessModalAndReset();
  switchTab('records');
}

// =========================================================================
// Worker Personal Attendance History (Private to Each Worker)
// =========================================================================

async function loadWorkerHistory(manual = false) {
  let workerId = dom.workerId ? dom.workerId.value.trim() : '';

  // If workerId is empty in form, try from saved profile
  if (!workerId) {
    try {
      const saved = localStorage.getItem('ngo_worker_profile');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.workerId) {
          workerId = data.workerId;
          if (dom.workerId) dom.workerId.value = workerId;
        }
      }
    } catch (e) {}
  }

  // If still no Worker ID
  if (!workerId) {
    if (dom.workerIdentityBanner) dom.workerIdentityBanner.style.display = 'none';
    if (dom.workerIdMissingNotice) dom.workerIdMissingNotice.style.display = 'block';
    if (dom.workerFilterPills) dom.workerFilterPills.style.display = 'none';
    if (dom.recordsList) dom.recordsList.innerHTML = '';
    if (dom.recordsCountBadge) dom.recordsCountBadge.textContent = '0';
    return;
  }

  // Worker ID is available
  if (dom.workerIdentityBanner) dom.workerIdentityBanner.style.display = 'flex';
  if (dom.displayWorkerIdBadge) dom.displayWorkerIdBadge.textContent = workerId;
  if (dom.workerIdMissingNotice) dom.workerIdMissingNotice.style.display = 'none';
  if (dom.workerFilterPills) dom.workerFilterPills.style.display = 'flex';

  try {
    const res = await fetch(`/api/attendance?worker_id=${encodeURIComponent(workerId)}`);
    const data = await res.json();
    if (data.success) {
      state.workerRecords = data.records || [];
      updateWorkerFilterCounts(state.workerRecords);
      filterWorkerRecords();
      if (dom.recordsCountBadge) {
        dom.recordsCountBadge.textContent = state.workerRecords.length;
      }
      if (manual) {
        showToast('✓ My Attendance History refreshed');
      }
    } else {
      if (dom.recordsList) {
        dom.recordsList.innerHTML = `<div class="empty-state"><p>${escapeHtml(data.error || 'Could not load records')}</p></div>`;
      }
    }
  } catch (err) {
    console.error('Failed to load worker records:', err);
    if (dom.recordsList) {
      dom.recordsList.innerHTML = `<div class="empty-state"><p>Could not connect to server to fetch history.</p></div>`;
    }
  }
}

function updateWorkerFilterCounts(records) {
  const allCount = records.length;
  const checkInCount = records.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN').length;
  const checkOutCount = records.filter(r => r.entry_type === 'CHECK-OUT').length;

  if (dom.countAllPill) dom.countAllPill.textContent = allCount;
  if (dom.countCheckInPill) dom.countCheckInPill.textContent = checkInCount;
  if (dom.countCheckOutPill) dom.countCheckOutPill.textContent = checkOutCount;
}

function setRecordFilter(filter) {
  state.recordFilter = filter;

  if (dom.pillFilterAll) dom.pillFilterAll.classList.toggle('active', filter === 'ALL');
  if (dom.pillFilterCheckIn) dom.pillFilterCheckIn.classList.toggle('active', filter === 'CHECK-IN');
  if (dom.pillFilterCheckOut) dom.pillFilterCheckOut.classList.toggle('active', filter === 'CHECK-OUT');

  filterWorkerRecords();
}

function filterWorkerRecords() {
  let filtered = state.workerRecords || [];

  if (state.recordFilter === 'CHECK-IN') {
    filtered = filtered.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN');
  } else if (state.recordFilter === 'CHECK-OUT') {
    filtered = filtered.filter(r => r.entry_type === 'CHECK-OUT');
  }

  renderWorkerRecords(filtered);
}

function renderWorkerRecords(records) {
  if (!dom.recordsList) return;

  if (!records || records.length === 0) {
    dom.recordsList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>No punches recorded yet for this Worker ID.</p>
        <small style="color:#94a3b8;">Your check-ins and check-outs will be listed here privately.</small>
      </div>
    `;
    return;
  }

  dom.recordsList.innerHTML = records.map(rec => renderRecordCardHtml(rec, false)).join('');
}

// Reusable attendance card HTML renderer
function renderRecordCardHtml(rec, isManagerView) {
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
          <span class="record-detail-label">Site / Village</span>
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
// Manager Portal Authentication & Full Dashboard
// =========================================================================

async function handleManagerPortalClick() {
  if (state.managerPin) {
    try {
      const res = await fetch('/api/verify-manager-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: state.managerPin })
      });
      const data = await res.json();
      if (data.success) {
        openManagerDashboardModal();
        loadManagerDashboard();
        return;
      }
    } catch (e) {}
  }
  openManagerPinModal();
}

function openManagerPinModal() {
  if (dom.pinErrorMessage) dom.pinErrorMessage.style.display = 'none';
  if (dom.managerPinInput) dom.managerPinInput.value = '';
  if (dom.managerPinModal) {
    dom.managerPinModal.style.display = 'flex';
    setTimeout(() => {
      if (dom.managerPinInput) dom.managerPinInput.focus();
    }, 150);
  }
}

function closeManagerPinModal() {
  if (dom.managerPinModal) dom.managerPinModal.style.display = 'none';
  if (dom.managerPinInput) dom.managerPinInput.value = '';
  if (dom.pinErrorMessage) dom.pinErrorMessage.style.display = 'none';
}

function appendPinDigit(digit) {
  if (dom.managerPinInput && dom.managerPinInput.value.length < 8) {
    dom.managerPinInput.value += digit;
    vibrateDevice([15]);
  }
}

function clearPinInput() {
  if (dom.managerPinInput) dom.managerPinInput.value = '';
  if (dom.pinErrorMessage) dom.pinErrorMessage.style.display = 'none';
}

async function submitManagerPin(event) {
  if (event) event.preventDefault();
  const pin = dom.managerPinInput ? dom.managerPinInput.value.trim() : '';

  if (!pin) {
    if (dom.pinErrorMessage) {
      dom.pinErrorMessage.textContent = 'Please enter your Manager PIN';
      dom.pinErrorMessage.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch('/api/verify-manager-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (data.success) {
      state.managerPin = pin;
      sessionStorage.setItem('ngo_manager_pin', pin);
      closeManagerPinModal();
      openManagerDashboardModal();
      loadManagerDashboard();
      showToast('✓ Manager Access Granted');
    } else {
      if (dom.pinErrorMessage) {
        dom.pinErrorMessage.textContent = data.error || 'Incorrect PIN. Please try again.';
        dom.pinErrorMessage.style.display = 'block';
      }
      if (dom.managerPinInput) dom.managerPinInput.value = '';
      vibrateDevice([80, 50, 80]);
    }
  } catch (err) {
    if (dom.pinErrorMessage) {
      dom.pinErrorMessage.textContent = 'Network error connecting to server';
      dom.pinErrorMessage.style.display = 'block';
    }
  }
}

function openManagerDashboardModal() {
  if (dom.managerDashboardModal) dom.managerDashboardModal.style.display = 'flex';
}

function lockManagerPortal() {
  state.managerPin = null;
  sessionStorage.removeItem('ngo_manager_pin');
  if (dom.managerDashboardModal) dom.managerDashboardModal.style.display = 'none';
  showToast('🔒 Manager Portal Locked');
}

async function loadManagerDashboard() {
  if (!state.managerPin) {
    openManagerPinModal();
    return;
  }

  // Set CSV download link with authenticated PIN query param
  if (dom.btnManagerExportCsv) {
    dom.btnManagerExportCsv.href = `/api/export.csv?pin=${encodeURIComponent(state.managerPin)}`;
  }

  // Load server settings & pending sync counts
  loadSettings();

  // Load all attendance records
  try {
    const res = await fetch('/api/attendance', {
      headers: { 'X-Manager-PIN': state.managerPin }
    });
    if (res.status === 401) {
      state.managerPin = null;
      sessionStorage.removeItem('ngo_manager_pin');
      if (dom.managerDashboardModal) dom.managerDashboardModal.style.display = 'none';
      openManagerPinModal();
      return;
    }
    const data = await res.json();
    if (data.success) {
      state.managerRecords = data.records || [];
      updateManagerDashboardStats(state.managerRecords);
      filterManagerRecords(dom.managerSearchInput ? dom.managerSearchInput.value : '');
    }
  } catch (err) {
    console.error('Failed to load manager records:', err);
  }
}

function updateManagerDashboardStats(records) {
  const total = records.length;
  const checkIns = records.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN').length;
  const checkOuts = records.filter(r => r.entry_type === 'CHECK-OUT').length;
  const unsynced = records.filter(r => !r.synced_to_sheet).length;

  if (dom.statTotalPunches) dom.statTotalPunches.textContent = total;
  if (dom.statCheckIns) dom.statCheckIns.textContent = checkIns;
  if (dom.statCheckOuts) dom.statCheckOuts.textContent = checkOuts;
  if (dom.countManagerAll) dom.countManagerAll.textContent = total;
  if (dom.countManagerCheckIn) dom.countManagerCheckIn.textContent = checkIns;
  if (dom.countManagerCheckOut) dom.countManagerCheckOut.textContent = checkOuts;
  if (dom.managerUnsyncedCount) dom.managerUnsyncedCount.textContent = unsynced;
}

function setManagerFilter(filter) {
  state.managerFilter = filter;

  if (dom.pillManagerFilterAll) dom.pillManagerFilterAll.classList.toggle('active', filter === 'ALL');
  if (dom.pillManagerFilterCheckIn) dom.pillManagerFilterCheckIn.classList.toggle('active', filter === 'CHECK-IN');
  if (dom.pillManagerFilterCheckOut) dom.pillManagerFilterCheckOut.classList.toggle('active', filter === 'CHECK-OUT');

  filterManagerRecords(dom.managerSearchInput ? dom.managerSearchInput.value : '');
}

function filterManagerRecords(query) {
  const q = (query || '').toLowerCase().trim();
  let filtered = state.managerRecords || [];

  if (state.managerFilter === 'CHECK-IN') {
    filtered = filtered.filter(r => (r.entry_type || 'CHECK-IN') === 'CHECK-IN');
  } else if (state.managerFilter === 'CHECK-OUT') {
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

  renderManagerRecords(filtered);
}

function renderManagerRecords(records) {
  if (!dom.managerRecordsList) return;

  if (!records || records.length === 0) {
    dom.managerRecordsList.innerHTML = `
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

  dom.managerRecordsList.innerHTML = records.map(rec => renderRecordCardHtml(rec, true)).join('');
}

// =========================================================================
// Change Manager PIN
// =========================================================================

function openChangePinModal() {
  if (dom.inputCurrentPin) dom.inputCurrentPin.value = '';
  if (dom.inputNewPin) dom.inputNewPin.value = '';
  if (dom.inputConfirmNewPin) dom.inputConfirmNewPin.value = '';
  if (dom.changePinModal) dom.changePinModal.style.display = 'flex';
}

function closeChangePinModal() {
  if (dom.changePinModal) dom.changePinModal.style.display = 'none';
}

async function submitChangePin(event) {
  if (event) event.preventDefault();
  const current_pin = dom.inputCurrentPin ? dom.inputCurrentPin.value.trim() : '';
  const new_pin = dom.inputNewPin ? dom.inputNewPin.value.trim() : '';
  const confirm_pin = dom.inputConfirmNewPin ? dom.inputConfirmNewPin.value.trim() : '';

  if (new_pin.length < 4) {
    showToast('New PIN must be at least 4 digits');
    return;
  }
  if (new_pin !== confirm_pin) {
    showToast('New PINs do not match');
    return;
  }

  try {
    const res = await fetch('/api/change-manager-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-PIN': state.managerPin || current_pin
      },
      body: JSON.stringify({ current_pin, new_pin })
    });
    const data = await res.json();
    if (data.success) {
      state.managerPin = new_pin;
      sessionStorage.setItem('ngo_manager_pin', new_pin);
      if (dom.btnManagerExportCsv) {
        dom.btnManagerExportCsv.href = `/api/export.csv?pin=${encodeURIComponent(new_pin)}`;
      }
      closeChangePinModal();
      showToast('✓ Manager PIN updated successfully!');
    } else {
      showToast('Error: ' + (data.error || 'Failed to update PIN'));
    }
  } catch (err) {
    showToast('Network error updating PIN');
  }
}

// =========================================================================
// Settings & Google Sheet Integration (Manager Only)
// =========================================================================

async function loadSettings() {
  if (!state.managerPin) return; // Only managers access backend settings

  try {
    const res = await fetch('/api/settings', {
      headers: { 'X-Manager-PIN': state.managerPin }
    });
    const data = await res.json();
    if (data.success) {
      state.settings = data.settings;
      if (dom.googleSheetUrlInput) dom.googleSheetUrlInput.value = data.settings.google_sheet_url || '';
      if (dom.googleWebhookInput) dom.googleWebhookInput.value = data.settings.google_sheet_webhook_url || '';
      
      const sheetUrl = data.settings.google_sheet_url || 'https://docs.google.com/spreadsheets/d/126zQm54eFZyDvKWlUvi1efvorLNP5l_cfibAiespP6s/edit?usp=sharing';
      if (dom.currentSheetDisplay) dom.currentSheetDisplay.textContent = sheetUrl;
      if (dom.btnOpenGoogleSheet) dom.btnOpenGoogleSheet.href = sheetUrl;

      const isConnected = data.settings.has_service_account || !!data.settings.google_sheet_webhook_url;
      if (dom.googleSheetBadge) {
        if (data.settings.has_service_account) {
          dom.googleSheetBadge.textContent = 'Google API Direct ✓';
          dom.googleSheetBadge.className = 'status-badge connected';
        } else if (data.settings.google_sheet_webhook_url) {
          dom.googleSheetBadge.textContent = 'Apps Script Active ✓';
          dom.googleSheetBadge.className = 'status-badge connected';
        } else {
          dom.googleSheetBadge.textContent = 'Local CSV Active';
          dom.googleSheetBadge.className = 'status-badge';
        }
      }

      if (dom.unsyncedCountText) {
        dom.unsyncedCountText.textContent = `${data.stats.unsynced_records} unsynced record${data.stats.unsynced_records === 1 ? '' : 's'}`;
      }
      if (dom.managerUnsyncedCount) {
        dom.managerUnsyncedCount.textContent = data.stats.unsynced_records;
      }

      if (dom.btnSyncNow) {
        dom.btnSyncNow.style.display = (isConnected && data.stats.unsynced_records > 0) ? 'inline-block' : 'none';
      }
    }
  } catch (err) {}
}

function updateSheetOpenLink() {
  const url = dom.googleSheetUrlInput?.value.trim();
  if (url && dom.btnOpenGoogleSheet && dom.currentSheetDisplay) {
    dom.btnOpenGoogleSheet.href = url;
    dom.currentSheetDisplay.textContent = url;
  }
}

async function saveSheetSettings(event) {
  event.preventDefault();
  if (!state.managerPin) {
    openManagerPinModal();
    return;
  }

  const google_sheet_url = dom.googleSheetUrlInput.value.trim();
  const google_sheet_webhook_url = dom.googleWebhookInput.value.trim();
  const google_service_account_json = dom.serviceAccountJsonInput ? dom.serviceAccountJsonInput.value.trim() : undefined;

  try {
    const payload = { google_sheet_url, google_sheet_webhook_url };
    if (google_service_account_json) payload.google_service_account_json = google_service_account_json;

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-PIN': state.managerPin
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Sheet settings saved successfully!');
      closeSheetConfigModal();
      loadSettings();
    } else {
      showToast('Error saving settings: ' + data.error);
    }
  } catch (err) {
    showToast('Failed to save settings');
  }
}

async function testSheetWebhook() {
  if (!state.managerPin) {
    openManagerPinModal();
    return;
  }

  const webhook_url = dom.googleWebhookInput.value.trim();
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
        'X-Manager-PIN': state.managerPin
      },
      body: JSON.stringify({ webhook_url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Connection successful! Test row appended to Google Sheet.', 5000);
      loadSettings();
      loadManagerDashboard();
    } else {
      showToast('Connection failed: ' + (data.error || 'Check Webhook URL & permissions'), 7000);
    }
  } catch (err) {
    showToast('Test failed: ' + err.message, 5000);
  }
}

async function testServiceAccountConnection() {
  if (!state.managerPin) {
    openManagerPinModal();
    return;
  }

  const jsonStr = dom.serviceAccountJsonInput ? dom.serviceAccountJsonInput.value.trim() : '';
  const sheet_url = dom.googleSheetUrlInput ? dom.googleSheetUrlInput.value.trim() : '';

  showToast('Testing Direct Google Sheets API connection...', 4000);
  try {
    if (jsonStr) {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Manager-PIN': state.managerPin
        },
        body: JSON.stringify({ google_service_account_json: jsonStr, google_sheet_url: sheet_url })
      });
    }

    const res = await fetch('/api/test-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Manager-PIN': state.managerPin
      },
      body: JSON.stringify({ method: 'service_account', sheet_url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Direct Google Sheets API connection verified! Row appended.', 5000);
      loadSettings();
      loadManagerDashboard();
    } else {
      showToast('API Connection failed: ' + (data.error || 'Check service account permissions'), 7000);
    }
  } catch (err) {
    showToast('Direct API Test failed: ' + err.message, 5000);
  }
}

async function syncPendingRecords() {
  if (!state.managerPin) {
    openManagerPinModal();
    return;
  }

  if (dom.btnSyncNow) dom.btnSyncNow.disabled = true;
  showToast('Syncing records to Google Sheet...');

  try {
    const res = await fetch('/api/sync-to-sheet', {
      method: 'POST',
      headers: { 'X-Manager-PIN': state.managerPin }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✓ Successfully synced ${data.synced_count} records to Google Sheet!`);
      loadWorkerHistory();
      loadSettings();
      loadManagerDashboard();
    } else {
      const errMsg = data.error || (data.errors && data.errors.length ? data.errors[0] : 'Check webhook URL or network');
      showToast('Sync incomplete: ' + errMsg, 6000);
    }
  } catch (err) {
    showToast('Error during sync: ' + err.message);
  } finally {
    if (dom.btnSyncNow) dom.btnSyncNow.disabled = false;
  }
}

function openSheetConfigModal() {
  dom.sheetConfigModal.style.display = 'flex';
}

function closeSheetConfigModal() {
  dom.sheetConfigModal.style.display = 'none';
}

function copyAppsScriptCode() {
  const code = document.getElementById('appsScriptSnippet').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('✓ Apps Script code copied to clipboard!');
  }).catch(() => {
    showToast('Please select and copy manually');
  });
}

// =========================================================================
// Tab Navigation & UI Helpers
// =========================================================================

function switchTab(tabName) {
  if (tabName === 'mark') {
    dom.tabMarkBtn.classList.add('active');
    dom.tabRecordsBtn.classList.remove('active');
    dom.sectionMark.style.display = 'block';
    dom.sectionRecords.style.display = 'none';
    checkWorkerDutyStatus();
  } else {
    dom.tabMarkBtn.classList.remove('active');
    dom.tabRecordsBtn.classList.add('active');
    dom.sectionMark.style.display = 'none';
    dom.sectionRecords.style.display = 'block';
    loadWorkerHistory();
  }
}

function handleModalBackdropClick(event) {
  if (event.target === dom.sheetConfigModal) {
    closeSheetConfigModal();
  }
  if (event.target === dom.managerPinModal) {
    closeManagerPinModal();
  }
  if (event.target === dom.changePinModal) {
    closeChangePinModal();
  }
}

function openPhotoModal(imgUrl, title, timeStr) {
  dom.fullPhotoImg.src = imgUrl;
  dom.photoModalMeta.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>Captured: ${escapeHtml(timeStr)}</span>
  `;
  dom.photoModal.style.display = 'flex';
}

function closePhotoModal() {
  dom.photoModal.style.display = 'none';
}

function showToast(message, duration = 3500) {
  const toast = dom.toast;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function vibrateDevice(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
