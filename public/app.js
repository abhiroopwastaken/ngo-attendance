/**
 * Daily Attendance Field App — Client Logic
 * JKLFDP - Jammu & Kashmir, Leh and Ladakh
 */

const appState = {
  mode: 'check-in', // 'check-in' | 'check-out'
  activeTab: 'mark', // 'mark' | 'history'
  profileExpanded: false,
  photoCaptured: false,
  photoDataUrl: null,
  demoSceneIndex: 0,
  gpsAccuracy: 28,
  lat: '33.94241',
  lng: '74.79821',
  address: 'Chadoora, Budgam, J&K (191112)',
  mediaStream: null,
  workerRecords: [],
  historyFilter: 'ALL', // 'ALL' | 'CHECK-IN' | 'CHECK-OUT'
  siteNameManuallyEdited: false,
  isSubmitting: false
};

const DEMO_SCENES = [
  {
    label: 'Chadoora Field Sector • Relief Distribution',
    bgTop: '#1E293B',
    bgBottom: '#334155',
    hillColor: '#0F172A',
    accent: '#10B981'
  },
  {
    label: 'Budgam Block • Household Survey',
    bgTop: '#1C1917',
    bgBottom: '#292524',
    hillColor: '#0C0A09',
    accent: '#38BDF8'
  },
  {
    label: 'Chadoora Tehsil • Site Inspection',
    bgTop: '#111827',
    bgBottom: '#1F2937',
    hillColor: '#030712',
    accent: '#F59E0B'
  }
];

// =========================================================================
// Initialization
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  updateClock();
  setInterval(updateClock, 1000);

  checkSecurityContext();
  loadSavedWorkerDetails();
  syncProfileSummary();
  refreshGpsLocation();
  updateReadinessState();

  // If worker ID is already saved, check duty status and history
  const workerIdInput = document.getElementById('worker-id');
  if (workerIdInput && workerIdInput.value.trim()) {
    checkWorkerDutyStatus();
    loadWorkerHistory();
  }
});

window.addEventListener('beforeunload', () => {
  stopLiveCamera();
});

// =========================================================================
// Security Context (HTTPS Warning for Mobile Devices)
// =========================================================================

function checkSecurityContext() {
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const banner = document.getElementById('https-notice-banner');
  const switchBtn = document.getElementById('btn-switch-https');

  if (!isSecure && isMobile && banner) {
    banner.classList.remove('hidden');
    if (switchBtn) {
      switchBtn.href = `https://${location.hostname}:3443${location.pathname}`;
    }
  }
}

// =========================================================================
// Clock & Time
// =========================================================================

function updateClock() {
  const now = new Date();
  const shortTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const monthDay = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  const headerClock = document.getElementById('live-header-clock');
  const bannerClock = document.getElementById('live-date-timestamp');

  if (headerClock) headerClock.textContent = shortTime;
  if (bannerClock) bannerClock.textContent = `${monthDay}, ${shortTime}`;
}

// Auto-grow textarea
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// =========================================================================
// Tab Navigation
// =========================================================================

function switchTab(tab) {
  appState.activeTab = tab;
  const viewMark = document.getElementById('view-mark');
  const viewHistory = document.getElementById('view-history');
  const btnMark = document.getElementById('tab-btn-mark');
  const btnHistory = document.getElementById('tab-btn-history');
  const bottomDock = document.getElementById('bottom-action-dock');

  if (tab === 'mark') {
    viewMark.classList.remove('hidden');
    viewHistory.classList.add('hidden');
    bottomDock.classList.remove('hidden');

    btnMark.className = 'py-2 font-semibold text-ink-900 border-b-2 border-ink-900 transition-colors flex items-center gap-1.5';
    btnHistory.className = 'py-2 font-medium text-ink-600 hover:text-ink-900 border-b-2 border-transparent transition-colors flex items-center gap-1.5';
  } else {
    viewMark.classList.add('hidden');
    viewHistory.classList.remove('hidden');
    bottomDock.classList.add('hidden');

    btnHistory.className = 'py-2 font-semibold text-ink-900 border-b-2 border-ink-900 transition-colors flex items-center gap-1.5';
    btnMark.className = 'py-2 font-medium text-ink-600 hover:text-ink-900 border-b-2 border-transparent transition-colors flex items-center gap-1.5';

    loadWorkerHistory();
  }

  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// Segmented Mode Switcher (Check-In vs Check-Out)
// =========================================================================

function setAttendanceMode(mode) {
  appState.mode = mode;
  const inBtn = document.getElementById('mode-checkin-btn');
  const outBtn = document.getElementById('mode-checkout-btn');
  const punchBtn = document.getElementById('punch-submit-btn');
  const punchText = document.getElementById('punch-btn-text');
  const punchDot = document.getElementById('punch-btn-dot');

  if (mode === 'check-in') {
    inBtn.className = 'py-1.5 px-3 rounded-lg bg-white text-ink-900 shadow-minimal text-[13px] font-semibold flex items-center justify-center gap-2 transition-all';
    outBtn.className = 'py-1.5 px-3 rounded-lg text-ink-600 hover:text-ink-900 text-[13px] font-medium flex items-center justify-center gap-2 transition-all';

    punchBtn.className = 'w-full py-3 px-4 rounded-xl bg-[#065F46] hover:bg-[#047857] active:scale-[0.99] text-white font-semibold text-[14px] tracking-tight shadow-sm flex items-center justify-center gap-2 transition-all';
    punchDot.className = 'w-2 h-2 rounded-full bg-botanical-400';
    punchText.textContent = 'Punch Check-In';
  } else {
    outBtn.className = 'py-1.5 px-3 rounded-lg bg-white text-ink-900 shadow-minimal text-[13px] font-semibold flex items-center justify-center gap-2 transition-all';
    inBtn.className = 'py-1.5 px-3 rounded-lg text-ink-600 hover:text-ink-900 text-[13px] font-medium flex items-center justify-center gap-2 transition-all';

    punchBtn.className = 'w-full py-3 px-4 rounded-xl bg-terracotta-700 hover:bg-amber-800 active:scale-[0.99] text-white font-semibold text-[14px] tracking-tight shadow-sm flex items-center justify-center gap-2 transition-all';
    punchDot.className = 'w-2 h-2 rounded-full bg-amber-300';
    punchText.textContent = 'Punch Check-Out';
  }

  updateReadinessState();
}

// =========================================================================
// Worker Duty Status Check (Backend API)
// =========================================================================

async function checkWorkerDutyStatus() {
  const workerIdInput = document.getElementById('worker-id');
  const workerId = workerIdInput ? workerIdInput.value.trim() : '';
  const banner = document.getElementById('active-duty-banner');
  const siteEl = document.getElementById('active-duty-site');
  const timeEl = document.getElementById('active-duty-time');

  if (!workerId) {
    if (banner) banner.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/worker-status?worker_id=${encodeURIComponent(workerId)}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && data.status === 'CHECK-IN' && data.latest_record) {
      if (banner) {
        banner.classList.remove('hidden');
        if (siteEl) siteEl.textContent = data.latest_record.site_name || 'Field Site';
        if (timeEl) timeEl.textContent = data.latest_record.formatted_time || 'Earlier';
      }
      // If currently check-in mode, switch to check-out for convenience
      if (appState.mode === 'check-in') {
        setAttendanceMode('check-out');
      }
    } else {
      if (banner) banner.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Duty status check error:', err);
  }
}

function onWorkerIdChange() {
  syncProfileSummary();
  checkWorkerDutyStatus();
  if (appState.activeTab === 'history') {
    loadWorkerHistory();
  }
}

// =========================================================================
// Profile Accordion & Storage
// =========================================================================

function toggleProfileAccordion() {
  appState.profileExpanded = !appState.profileExpanded;
  const container = document.getElementById('profile-collapse-container');
  const label = document.getElementById('profile-edit-label');
  const chevron = document.getElementById('profile-chevron');

  if (appState.profileExpanded) {
    container.classList.add('expanded');
    label.textContent = 'Close';
    chevron.style.transform = 'rotate(180deg)';
  } else {
    container.classList.remove('expanded');
    label.textContent = 'Edit';
    chevron.style.transform = 'rotate(0deg)';
  }
}

function syncProfileSummary() {
  const nameInput = document.getElementById('worker-name');
  const idInput = document.getElementById('worker-id');
  const supInput = document.getElementById('supervisor-name');
  const contactInput = document.getElementById('supervisor-contact');
  const rememberCheck = document.getElementById('remember-profile');

  const name = nameInput ? nameInput.value.trim() : '';
  const id = idInput ? idInput.value.trim() : '';
  const sup = supInput ? supInput.value.trim() : '';

  const summaryName = document.getElementById('summary-worker-name');
  const summaryId = document.getElementById('summary-worker-id');
  const summarySup = document.getElementById('summary-supervisor-name');
  const avatar = document.getElementById('worker-avatar');
  const historyBadge = document.getElementById('history-worker-id-badge');

  if (summaryName) summaryName.textContent = name || 'Field Worker';
  if (summaryId) summaryId.textContent = id ? `(${id})` : '(ID)';
  if (summarySup) summarySup.textContent = sup || 'Unassigned';
  if (historyBadge) historyBadge.textContent = id || '--';

  // Compute initials
  if (avatar) {
    const parts = name.split(' ').filter(Boolean);
    let initials = 'FW';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }
    avatar.textContent = initials;
  }

  // Persist if checkbox enabled
  if (rememberCheck && rememberCheck.checked) {
    try {
      localStorage.setItem('ngo_worker_profile', JSON.stringify({
        workerName: name,
        workerId: id,
        supervisorName: sup,
        supervisorContact: contactInput ? contactInput.value.trim() : ''
      }));
    } catch (e) {}
  }

  updateReadinessState();
}

function loadSavedWorkerDetails() {
  try {
    const saved = localStorage.getItem('ngo_worker_profile');
    if (!saved) return;
    const data = JSON.parse(saved);

    const nameInput = document.getElementById('worker-name');
    const idInput = document.getElementById('worker-id');
    const supInput = document.getElementById('supervisor-name');
    const contactInput = document.getElementById('supervisor-contact');

    if (nameInput && data.workerName) nameInput.value = data.workerName;
    if (idInput && data.workerId) idInput.value = data.workerId;
    if (supInput && data.supervisorName) supInput.value = data.supervisorName;
    if (contactInput && data.supervisorContact) contactInput.value = data.supervisorContact;
  } catch (e) {
    console.warn('Could not read saved profile:', e);
  }
}

// =========================================================================
// Real GPS & Reverse Geocoding
// =========================================================================

function refreshGpsLock() {
  refreshGpsLocation(true);
}

function refreshGpsLocation(isManualClick = false) {
  const icon = document.getElementById('refresh-gps-icon');
  const accEl = document.getElementById('gps-accuracy-label');
  const coordsEl = document.getElementById('gps-coords-text');
  const addrEl = document.getElementById('gps-address-text');

  if (icon) icon.classList.add('animate-spin');

  if (!navigator.geolocation) {
    fallbackGpsSimulation('Geolocation unsupported');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (icon) icon.classList.remove('animate-spin');
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = Math.round(position.coords.accuracy || 25);

      appState.lat = lat.toFixed(5);
      appState.lng = lng.toFixed(5);
      appState.gpsAccuracy = acc;

      if (coordsEl) coordsEl.textContent = `${appState.lat}, ${appState.lng}`;
      if (accEl) accEl.textContent = `±${appState.gpsAccuracy}m`;

      // Update live camera telemetry text if stream is active
      const camTelem = document.getElementById('live-camera-telemetry');
      if (camTelem) camTelem.textContent = `${appState.lat}, ${appState.lng} (±${appState.gpsAccuracy}m)`;

      // Reverse geocode
      await reverseGeocode(lat, lng);

      // If photo is already captured, update watermark
      if (appState.photoCaptured) {
        stampMinimalWatermark(document.getElementById('geotag-canvas'));
      }

      if (isManualClick) {
        showToast(`GPS locked (±${appState.gpsAccuracy}m)`, false);
      }
    },
    (error) => {
      if (icon) icon.classList.remove('animate-spin');
      console.warn('Geolocation error:', error.message);
      fallbackGpsSimulation(error.message);
      if (isManualClick) {
        showToast('Using estimated GPS coordinates', false);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function fallbackGpsSimulation(reason) {
  const icon = document.getElementById('refresh-gps-icon');
  const accEl = document.getElementById('gps-accuracy-label');
  const coordsEl = document.getElementById('gps-coords-text');
  const addrEl = document.getElementById('gps-address-text');

  if (icon) icon.classList.remove('animate-spin');

  appState.gpsAccuracy = Math.floor(Math.random() * 12) + 18;
  appState.lat = (33.94241 + (Math.random() - 0.5) * 0.00015).toFixed(5);
  appState.lng = (74.79821 + (Math.random() - 0.5) * 0.00015).toFixed(5);
  appState.address = 'Chadoora, Budgam, J&K (191112)';

  if (coordsEl) coordsEl.textContent = `${appState.lat}, ${appState.lng}`;
  if (accEl) accEl.textContent = `±${appState.gpsAccuracy}m`;
  if (addrEl) addrEl.textContent = appState.address;

  if (appState.photoCaptured) {
    stampMinimalWatermark(document.getElementById('geotag-canvas'));
  }
}

async function reverseGeocode(lat, lng) {
  const addrEl = document.getElementById('gps-address-text');
  const locationInput = document.getElementById('location-name');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const village = a.village || a.suburb || a.hamlet || a.town || a.city_district || a.county || '';
        const stateDistrict = a.state_district || a.county || '';
        const postcode = a.postcode ? ` (${a.postcode})` : '';

        const formatted = [village, stateDistrict, a.state || 'J&K'].filter(Boolean).join(', ') + postcode;
        appState.address = formatted || data.display_name;
        if (addrEl) addrEl.textContent = appState.address;

        if (!appState.siteNameManuallyEdited && locationInput && village) {
          locationInput.value = village;
        }
        return;
      }
    }
  } catch (e) {
    // Graceful fallback to default address
  }

  appState.address = 'Chadoora, Budgam, J&K (191112)';
  if (addrEl) addrEl.textContent = appState.address;
}

function onSiteNameInput() {
  appState.siteNameManuallyEdited = true;
  updateReadinessState();
}

// =========================================================================
// Photo Capture & Watermark Generation
// =========================================================================

function handlePhotoSurfaceClick() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const camInput = document.getElementById('native-camera-input');
    if (camInput) {
      camInput.click();
      return;
    }
  }
  startLiveCamera();
}

async function startLiveCamera() {
  const video = document.getElementById('camera-video');
  const emptyState = document.getElementById('photo-empty-state');
  const liveState = document.getElementById('photo-live-state');
  const previewState = document.getElementById('photo-preview-state');

  try {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    appState.mediaStream = stream;
    video.srcObject = stream;

    emptyState.classList.add('hidden');
    previewState.classList.add('hidden');
    liveState.classList.remove('hidden');

    const telem = document.getElementById('live-camera-telemetry');
    if (telem) {
      telem.textContent = `${appState.lat}, ${appState.lng} (±${appState.gpsAccuracy}m)`;
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.warn('Camera stream failed, using simulated capture:', err);
    captureSimulatedFieldPhoto();
    showToast('Simulated verification photo captured', false);
  }
}

function stopLiveCamera() {
  if (appState.mediaStream) {
    appState.mediaStream.getTracks().forEach(t => t.stop());
    appState.mediaStream = null;
  }
  const liveState = document.getElementById('photo-live-state');
  if (liveState) liveState.classList.add('hidden');

  if (!appState.photoCaptured) {
    const emptyState = document.getElementById('photo-empty-state');
    if (emptyState) emptyState.classList.remove('hidden');
  }
}

function snapFromLiveVideo() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('geotag-canvas');
  if (!video || !canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  stopLiveCamera();
  stampMinimalWatermark(canvas);

  document.getElementById('photo-live-state').classList.add('hidden');
  document.getElementById('photo-preview-state').classList.remove('hidden');
  markPhotoVerified();
}

function handleFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      stopLiveCamera();
      document.getElementById('photo-empty-state').classList.add('hidden');
      document.getElementById('photo-live-state').classList.add('hidden');
      document.getElementById('photo-preview-state').classList.remove('hidden');

      const canvas = document.getElementById('geotag-canvas');
      const ctx = canvas.getContext('2d');

      // Center crop into 16:10 aspect
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      stampMinimalWatermark(canvas);
      markPhotoVerified();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function captureSimulatedFieldPhoto() {
  stopLiveCamera();
  document.getElementById('photo-empty-state').classList.add('hidden');
  document.getElementById('photo-live-state').classList.add('hidden');
  document.getElementById('photo-preview-state').classList.remove('hidden');

  renderSimulatedCanvasScene(appState.demoSceneIndex);
  markPhotoVerified();
}

function cycleSimulatedScene() {
  appState.demoSceneIndex = (appState.demoSceneIndex + 1) % DEMO_SCENES.length;
  renderSimulatedCanvasScene(appState.demoSceneIndex);
}

function renderSimulatedCanvasScene(idx) {
  const canvas = document.getElementById('geotag-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const scene = DEMO_SCENES[idx];

  // Calm gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, scene.bgTop);
  grad.addColorStop(1, scene.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Minimalist mountain ridge silhouette
  ctx.fillStyle = scene.hillColor;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.65);
  ctx.lineTo(W * 0.25, H * 0.42);
  ctx.lineTo(W * 0.48, H * 0.55);
  ctx.lineTo(W * 0.72, H * 0.36);
  ctx.lineTo(W, H * 0.52);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Subtle site marker pill at top-left
  ctx.fillStyle = 'rgba(17, 24, 39, 0.72)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 24, 330, 36, 8);
  } else {
    ctx.rect(24, 24, 330, 36);
  }
  ctx.fill();

  ctx.fillStyle = scene.accent;
  ctx.beginPath();
  ctx.arc(40, 42, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F9FAFB';
  ctx.font = '500 13px Inter, -apple-system, sans-serif';
  ctx.fillText(scene.label, 54, 47);

  stampMinimalWatermark(canvas);
}

function stampMinimalWatermark(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const workerNameInput = document.getElementById('worker-name');
  const locationInput = document.getElementById('location-name');
  const headerClock = document.getElementById('live-header-clock');

  const workerName = (workerNameInput && workerNameInput.value.trim()) || 'Abhiroop Agarwal';
  const siteName = (locationInput && locationInput.value.trim()) || 'Chadoora';
  const timeStr = headerClock ? headerClock.textContent : '--:--';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Dark translucent bottom bar
  ctx.fillStyle = 'rgba(17, 24, 39, 0.88)';
  ctx.fillRect(0, H - 78, W, 78);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 15px Inter, -apple-system, sans-serif';
  ctx.fillText(`JKLFDP • ${siteName} (${appState.lat}, ${appState.lng})`, 24, H - 44);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '500 13px JetBrains Mono, monospace';
  ctx.fillText(`${dateStr} ${timeStr}  •  ${workerName}  •  GPS ±${appState.gpsAccuracy}m`, 24, H - 20);

  appState.photoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
}

function markPhotoVerified() {
  appState.photoCaptured = true;
  const badge = document.getElementById('photo-status-badge');
  if (badge) {
    badge.className = 'text-[11px] font-medium px-2 py-0.5 rounded-full bg-botanical-50 text-botanical-700';
    badge.textContent = 'Watermarked ✓';
  }
  updateReadinessState();
  if (window.lucide) lucide.createIcons();
}

function resetPhotoCapture() {
  stopLiveCamera();
  appState.photoCaptured = false;
  appState.photoDataUrl = null;

  const previewState = document.getElementById('photo-preview-state');
  const emptyState = document.getElementById('photo-empty-state');
  const badge = document.getElementById('photo-status-badge');

  if (previewState) previewState.classList.add('hidden');
  if (emptyState) emptyState.classList.remove('hidden');
  if (badge) {
    badge.className = 'text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-ink-600';
    badge.textContent = 'Required';
  }

  updateReadinessState();
  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// Visit Form & Suggestion Chips
// =========================================================================

function selectPurposeChip(btnEl, text) {
  const input = document.getElementById('visit-purpose');
  if (input) input.value = text;

  document.querySelectorAll('.purpose-chip').forEach(chip => {
    chip.className = 'purpose-chip px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-[#F3F4F6] text-ink-600 hover:text-ink-900 border border-transparent transition';
  });

  if (btnEl) {
    btnEl.className = 'purpose-chip px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-botanical-50 text-botanical-700 border border-botanical-100 transition';
  }

  updateReadinessState();
}

function clearPurposeInput() {
  const input = document.getElementById('visit-purpose');
  if (input) {
    input.value = '';
    input.focus();
  }
  document.querySelectorAll('.purpose-chip').forEach(chip => {
    chip.className = 'purpose-chip px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-[#F3F4F6] text-ink-600 hover:text-ink-900 border border-transparent transition';
  });
  updateReadinessState();
}

// =========================================================================
// Readiness State & Demo Auto-Fill
// =========================================================================

function updateReadinessState() {
  const purposeInput = document.getElementById('visit-purpose');
  const locInput = document.getElementById('location-name');
  const clearBtn = document.getElementById('clear-purpose-btn');
  const helperText = document.getElementById('readiness-helper-text');
  const quickFillBtn = document.getElementById('quick-fill-btn');

  const purpose = purposeInput ? purposeInput.value.trim() : '';
  const loc = locInput ? locInput.value.trim() : '';

  if (clearBtn) {
    if (purpose.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (!helperText) return;

  const modeLabel = appState.mode === 'check-in' ? 'Check-In' : 'Check-Out';

  if (appState.photoCaptured && purpose && loc) {
    helperText.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-botanical-600"></span>
      <span class="text-botanical-700 font-medium">Ready to punch ${modeLabel}</span>
    `;
    if (quickFillBtn) quickFillBtn.classList.add('hidden');
  } else if (!appState.photoCaptured && !purpose) {
    helperText.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
      <span>Photo &amp; purpose required</span>
    `;
    if (quickFillBtn) quickFillBtn.classList.remove('hidden');
  } else if (!appState.photoCaptured) {
    helperText.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-terracotta-600"></span>
      <span>Capture verification photo above</span>
    `;
    if (quickFillBtn) quickFillBtn.classList.remove('hidden');
  } else {
    helperText.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-terracotta-600"></span>
      <span>Enter or select visit purpose</span>
    `;
    if (quickFillBtn) quickFillBtn.classList.remove('hidden');
  }
}

function fillDemoState() {
  const nameInput = document.getElementById('worker-name');
  const idInput = document.getElementById('worker-id');
  const supInput = document.getElementById('supervisor-name');
  const notesInput = document.getElementById('field-notes');
  const locInput = document.getElementById('location-name');

  if (nameInput && !nameInput.value.trim()) nameInput.value = 'Abhiroop Agarwal';
  if (idInput && !idInput.value.trim()) idInput.value = '9719003001';
  if (supInput && !supInput.value.trim()) supInput.value = 'Firdous';
  if (locInput && !locInput.value.trim()) locInput.value = 'Chadoora';

  syncProfileSummary();

  if (!appState.photoCaptured) {
    captureSimulatedFieldPhoto();
  }

  const chips = document.querySelectorAll('.purpose-chip');
  if (chips.length > 1) {
    selectPurposeChip(chips[1], 'Relief Distribution');
  }

  if (notesInput && !notesInput.value.trim()) {
    notesInput.value = 'Distributed 45 ration kits; surveyed 12 families';
    autoResizeTextarea(notesInput);
  }

  updateReadinessState();
  showToast('Demo fields populated', false);
}

// =========================================================================
// Submit Attendance (POST /api/attendance)
// =========================================================================

async function handlePunchSubmit() {
  if (appState.isSubmitting) return;

  const workerName = (document.getElementById('worker-name') || {}).value?.trim();
  const workerId = (document.getElementById('worker-id') || {}).value?.trim();
  const supName = (document.getElementById('supervisor-name') || {}).value?.trim();
  const supContact = (document.getElementById('supervisor-contact') || {}).value?.trim() || '';
  const purpose = (document.getElementById('visit-purpose') || {}).value?.trim();
  const locationName = (document.getElementById('location-name') || {}).value?.trim();
  const notes = (document.getElementById('field-notes') || {}).value?.trim() || '';

  // Validation
  if (!workerName || !workerId || !supName) {
    if (!appState.profileExpanded) toggleProfileAccordion();
    highlightCard('profile-card');
    showToast('Complete worker & supervisor info', true);
    return;
  }

  if (!appState.photoCaptured || !appState.photoDataUrl) {
    highlightCard('photo-card');
    showToast('Verification photo is required', true);
    return;
  }

  if (!purpose || !locationName) {
    highlightCard('visit-card');
    const pInput = document.getElementById('visit-purpose');
    if (pInput) pInput.focus();
    showToast('Please specify purpose of visit', true);
    return;
  }

  // Refresh watermark to ensure live timestamp is embedded
  const canvas = document.getElementById('geotag-canvas');
  if (canvas) stampMinimalWatermark(canvas);

  const punchBtn = document.getElementById('punch-submit-btn');
  const punchText = document.getElementById('punch-btn-text');
  appState.isSubmitting = true;
  if (punchBtn) punchBtn.disabled = true;
  if (punchText) punchText.textContent = 'Recording Attendance...';

  const entryType = appState.mode === 'check-in' ? 'CHECK-IN' : 'CHECK-OUT';

  const payload = {
    entry_type: entryType,
    worker_name: workerName,
    worker_id: workerId,
    purpose: purpose,
    site_name: locationName,
    address: appState.address || '',
    supervisor_name: supName,
    supervisor_contact: supContact,
    notes: notes,
    latitude: parseFloat(appState.lat) || null,
    longitude: parseFloat(appState.lng) || null,
    accuracy: parseInt(appState.gpsAccuracy) || null,
    photo_base64: appState.photoDataUrl,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success && data.record) {
      if (navigator.vibrate) navigator.vibrate([60, 40, 120]);

      showReceiptModal(data.record);
      checkWorkerDutyStatus();
      loadWorkerHistory();

      // Clear field notes for next punch
      const notesEl = document.getElementById('field-notes');
      if (notesEl) {
        notesEl.value = '';
        autoResizeTextarea(notesEl);
      }
    } else {
      showToast(data.error || 'Failed to record attendance', false);
    }
  } catch (err) {
    console.error('Submission error:', err);
    showToast('Connection error: could not save attendance', false);
  } finally {
    appState.isSubmitting = false;
    if (punchBtn) punchBtn.disabled = false;
    setAttendanceMode(appState.mode); // restores button label and styling
  }
}

// =========================================================================
// Receipt Sheet Modal
// =========================================================================

function showReceiptModal(record) {
  const modal = document.getElementById('receipt-modal');
  const title = document.getElementById('receipt-title');
  const subtitle = document.getElementById('receipt-subtitle');
  const photoImg = document.getElementById('receipt-photo-img');
  const workerEl = document.getElementById('receipt-worker');
  const purposeEl = document.getElementById('receipt-purpose');
  const locEl = document.getElementById('receipt-location');

  const isCheckIn = record.entry_type === 'CHECK-IN';
  if (title) title.textContent = isCheckIn ? 'Check-In Recorded' : 'Check-Out Recorded';

  const shortId = record.id ? 'JKL-' + record.id.slice(0, 5).toUpperCase() : 'JKL-VERIFIED';
  const timeStr = record.formatted_time || document.getElementById('live-header-clock').textContent;
  if (subtitle) subtitle.textContent = `${shortId} • Today, ${timeStr}`;

  if (photoImg) photoImg.src = record.photo_url || appState.photoDataUrl;
  if (workerEl) workerEl.textContent = `${record.worker_name} (${record.worker_id})`;
  if (purposeEl) purposeEl.textContent = record.purpose;
  if (locEl) locEl.textContent = `${record.site_name} (${appState.lat}, ${appState.lng})`;

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

function closeReceiptModal(tab) {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.add('hidden');

  // Reset captured photo for next entry
  resetPhotoCapture();

  if (tab === 'history') {
    switchTab('history');
  } else if (appState.mode === 'check-in') {
    setAttendanceMode('check-out');
  }
}

// =========================================================================
// History View (Private Worker Punches)
// =========================================================================

async function loadWorkerHistory(isManual = false) {
  const workerIdInput = document.getElementById('worker-id');
  const workerId = workerIdInput ? workerIdInput.value.trim() : '';

  const badge = document.getElementById('history-worker-id-badge');
  if (badge) badge.textContent = workerId || '--';

  if (!workerId) {
    appState.workerRecords = [];
    renderHistoryList();
    return;
  }

  try {
    const res = await fetch(`/api/attendance?worker_id=${encodeURIComponent(workerId)}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && Array.isArray(data.records)) {
      appState.workerRecords = data.records;
      renderHistoryList();

      const countBadge = document.getElementById('history-count-badge');
      if (countBadge) countBadge.textContent = appState.workerRecords.length;

      if (isManual) {
        showToast('Attendance history refreshed', false);
      }
    }
  } catch (err) {
    console.warn('History load error:', err);
  }
}

function setHistoryFilter(filter) {
  appState.historyFilter = filter;

  const btnAll = document.getElementById('history-filter-all');
  const btnIn = document.getElementById('history-filter-in');
  const btnOut = document.getElementById('history-filter-out');

  const activeClass = 'py-1.5 rounded-lg bg-white text-ink-900 shadow-minimal font-semibold transition';
  const inactiveClass = 'py-1.5 rounded-lg text-ink-600 hover:text-ink-900 transition';

  if (btnAll) btnAll.className = filter === 'ALL' ? activeClass : inactiveClass;
  if (btnIn) btnIn.className = filter === 'CHECK-IN' ? activeClass : inactiveClass;
  if (btnOut) btnOut.className = filter === 'CHECK-OUT' ? activeClass : inactiveClass;

  renderHistoryList();
}

function renderHistoryList() {
  const emptyState = document.getElementById('history-empty-state');
  const listEl = document.getElementById('history-list');
  const countAll = document.getElementById('history-count-all');
  const countIn = document.getElementById('history-count-in');
  const countOut = document.getElementById('history-count-out');

  const records = appState.workerRecords || [];

  const inCount = records.filter(r => r.entry_type === 'CHECK-IN').length;
  const outCount = records.filter(r => r.entry_type === 'CHECK-OUT').length;

  if (countAll) countAll.textContent = records.length;
  if (countIn) countIn.textContent = inCount;
  if (countOut) countOut.textContent = outCount;

  let filtered = records;
  if (appState.historyFilter === 'CHECK-IN') {
    filtered = records.filter(r => r.entry_type === 'CHECK-IN');
  } else if (appState.historyFilter === 'CHECK-OUT') {
    filtered = records.filter(r => r.entry_type === 'CHECK-OUT');
  }

  if (!listEl) return;

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  listEl.innerHTML = filtered.map(item => {
    const isCheckIn = item.entry_type === 'CHECK-IN';
    const pillStyle = isCheckIn
      ? 'bg-botanical-50 text-botanical-700'
      : 'bg-terracotta-50 text-terracotta-700';
    const label = isCheckIn ? 'Check-In' : 'Check-Out';
    const photoSrc = item.photo_url || appState.photoDataUrl || '';
    const safeTitle = escapeHtml(item.purpose || 'Attendance');
    const safeTime = escapeHtml(item.formatted_time || item.created_at || '');
    const coordsStr = (item.latitude && item.longitude)
      ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
      : 'GPS Active';

    return `
      <div class="bg-white rounded-2xl border border-[#E5E7EB] shadow-minimal p-3 flex gap-3 items-center">
        ${photoSrc ? `
          <img src="${photoSrc}" alt="Verification" onclick="openPhotoModal('${photoSrc}', '${safeTitle}', '${safeTime}')" class="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0 bg-ink-900 cursor-pointer" />
        ` : `
          <div class="w-16 h-16 rounded-xl bg-stone-100 border border-gray-200 shrink-0 flex items-center justify-center text-stone-400 text-xs">
            No Photo
          </div>
        `}
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[13px] font-semibold text-ink-900 truncate">${safeTitle}</span>
            <span class="text-[10.5px] font-medium px-2 py-0.5 rounded-md ${pillStyle} shrink-0">${label}</span>
          </div>
          <div class="text-xs text-ink-600 mt-0.5 truncate">
            ${escapeHtml(item.site_name || 'Field Site')} • Sup: ${escapeHtml(item.supervisor_name || 'N/A')}
          </div>
          <div class="flex items-center gap-2 text-[11px] font-mono text-ink-400 mt-1">
            <span>${safeTime}</span>
            <span>•</span>
            <span>${coordsStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// Lightbox Photo Modal & Toast
// =========================================================================

function openFullPhotoModal() {
  const canvas = document.getElementById('geotag-canvas');
  if (!canvas) return;
  const url = canvas.toDataURL('image/jpeg', 0.95);
  const worker = (document.getElementById('worker-name') || {}).value || 'Verification Photo';
  const time = (document.getElementById('live-header-clock') || {}).textContent || '';
  openPhotoModal(url, worker, `Today, ${time}`);
}

function openPhotoModal(imgUrl, title, subtitle) {
  const modal = document.getElementById('photo-modal');
  const img = document.getElementById('full-photo-img');
  const titleEl = document.getElementById('photo-modal-title');
  const subEl = document.getElementById('photo-modal-subtitle');

  if (img) img.src = imgUrl;
  if (titleEl) titleEl.textContent = title || 'Attendance Verification';
  if (subEl) subEl.textContent = subtitle || '';

  if (modal) modal.classList.remove('hidden');
}

function closePhotoModal() {
  const modal = document.getElementById('photo-modal');
  if (modal) modal.classList.add('hidden');
}

function highlightCard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('attention-ring');
  setTimeout(() => el.classList.remove('attention-ring'), 900);
}

let toastTimer = null;
function showToast(msg, allowAutoFill = false) {
  const banner = document.getElementById('toast-banner');
  const msgEl = document.getElementById('toast-message');
  const actionBtn = document.getElementById('toast-action-btn');

  if (!banner || !msgEl) return;

  msgEl.textContent = msg;

  if (actionBtn) {
    if (allowAutoFill) actionBtn.classList.remove('hidden');
    else actionBtn.classList.add('hidden');
  }

  banner.classList.remove('opacity-0', '-translate-y-2');
  banner.classList.add('opacity-100', 'translate-y-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    banner.classList.remove('opacity-100', 'translate-y-0');
    banner.classList.add('opacity-0', '-translate-y-2');
  }, 3200);
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
