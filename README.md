# 📋 NGO Field Worker Attendance App

A mobile-optimized attendance web application built specifically for NGO field workers. It captures verified photographs, GPS coordinates, timestamps, visit purpose, and supervisor details — automatically logging everything into a local spreadsheet and syncing to Google Sheets.

---

## 🔒 Worker Privacy & Manager Dashboard

To safeguard worker privacy while giving NGO leadership complete oversight:

### 👤 Field Worker Privacy
- **Private History**: Workers only see their own attendance punches under the **"My History"** tab (queried strictly by their assigned Worker ID / Phone).
- **Zero Visibility into Peers**: Field workers cannot view other workers' records, locations, or photos.
- **Admin Restrictions**: Administrative controls, CSV export, and Google Sheet configuration are hidden and locked from workers.

### 🛡️ Project Manager Portal
- **Access**: Click the discrete **"🔒 Manager"** button in the top-right header.
- **Default PIN**: `2026` (can be changed anytime directly from the manager dashboard).
- **Features for Project Managers**:
  - **Master Attendance Feed**: View real-time punches from every worker across all field sites.
  - **Fast Search & Filters**: Search across worker names, IDs, site locations, purpose, or supervisors; filter by Check-Ins or Check-Outs.
  - **Full CSV Report**: One-click download of the complete attendance ledger (`attendance_YYYY-MM-DD.csv`).
  - **Google Sheet Management**: Trigger on-demand syncs and configure the Apps Script Webhook or Service Account.
  - **Change PIN**: Update the Manager PIN securely with confirmation.
  - **Lock / Exit**: Instantly locks the session to prevent unauthorized access.

---

## 📱 Smartphone Access & Permissions Guide

Mobile browsers (iOS Safari and Android Chrome) enforce the **W3C Web Security standard**:
> **Sensitive hardware like GPS Geolocation and in-browser Camera permissions are strictly disabled over unencrypted HTTP (`http://192.168...`)**. On a desktop computer, `http://localhost` is exempt, which is why desktop works out of the box, but phones require HTTPS or native triggers.

### 🌟 2 Ways to Use on Your Phone:

#### Option 1 (Recommended): Secure HTTPS (Automatic GPS + Camera)
Open your phone's browser (Safari or Chrome) and navigate to:
```
https://10.173.77.239:3443
```
*(Replace with your computer's IP if it changes)*

**First-time 5-second certificate approval:**
- **On iPhone (Safari)**:
  1. Safari will show *"This Connection Is Not Private"*.
  2. Tap **"Show Details"** at the bottom.
  3. Tap **"visit this website"**, then tap **"Visit Website"**.
  4. Now Safari will ask: *"attendance would like to use your current location. [Allow]"* and camera permissions will work smoothly!
- **On Android (Chrome)**:
  1. Chrome will show *"Your connection is not private"*.
  2. Tap **"Advanced"** → **"Proceed to 10.173.77.239 (unsafe)"**.
  3. Chrome will prompt for Location and Camera permissions immediately!

---

#### Option 2: Plain HTTP (`http://10.173.77.239:3000`)
If you access via plain HTTP:
- **📸 Camera**: The app uses the **"Take Photo (Phone Camera)"** button (`capture="environment"`), which opens your smartphone's native camera directly! This works 100% on any mobile phone without needing HTTPS.
- **📍 GPS**: Mobile browsers disable GPS over plain HTTP. The app includes a **"Enter Coords Manually"** button or a 1-tap **"Switch to HTTPS"** banner at the top of the page.

---

## 🚀 Starting the Server

```bash
npm start
# or
node server.js
```

### URLs:
- **Desktop (Local)**: `http://localhost:3000` or `https://localhost:3443`
- **Phone (HTTP)**: `http://10.173.77.239:3000`
- **Phone (HTTPS - Full GPS & Camera)**: `https://10.173.77.239:3443`

---

## 📑 Spreadsheet Columns

| Column | Description |
|---|---|
| **Record ID** | Unique UUID for the attendance punch |
| **Timestamp (ISO)** | ISO-8601 machine timestamp |
| **Date & Time** | Formatted local date & time |
| **Punch Type** | `CHECK-IN` (Arrival) or `CHECK-OUT` (Departure) |
| **Field Worker Name** | Name of the NGO worker |
| **Worker ID / Phone** | Worker ID or contact number |
| **Purpose of Visit** | Specific visit purpose or activity completed |
| **Site / Location Name** | Village, community, or site name |
| **Supervisor Name** | Assigned supervisor's name |
| **Supervisor Contact** | Supervisor phone or email |
| **Latitude & Longitude** | Coordinates |
| **Accuracy (meters)** | GPS radius accuracy (e.g. ±8m) |
| **Google Maps Link** | Direct clickable link to location |
| **Photo URL** | Stored photo verification link |
| **Notes / Remarks** | Optional field observations or departure summary |
| **Synced to Google Sheet** | YES / NO sync status |

---

## 🛠️ Linking to Google Sheets

The app supports **two ways** to sync live attendance to your Google Sheet:

### Option 1: Google Apps Script Webhook (Recommended & Easiest)

1. Open your Google Sheet: [https://docs.google.com/spreadsheets/d/126zQm54eFZyDvKWlUvi1efvorLNP5l_cfibAiespP6s/edit](https://docs.google.com/spreadsheets/d/126zQm54eFZyDvKWlUvi1efvorLNP5l_cfibAiespP6s/edit)
2. In the top menu, click **Extensions** → **Apps Script**.
3. Replace all existing code in `Code.gs` with:
   ```javascript
   function doGet(e) {
     return ContentService
       .createTextOutput(JSON.stringify({ status: "active", message: "Attendance webhook is online and ready!" }))
       .setMimeType(ContentService.MimeType.JSON);
   }

   function doPost(e) {
     try {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
       if (sheet.getLastRow() === 0) {
         sheet.appendRow([
           "Record ID", "Timestamp", "Date & Time", "Punch Type", "Worker Name", 
           "Worker ID", "Purpose / Activity", "Site / Location", "Readable Address", 
           "Supervisor Name", "Supervisor Contact", "Latitude", "Longitude", 
           "Accuracy (m)", "Google Maps Link", "Photo URL", "Notes"
         ]);
         sheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#e2e8f0");
       }
       var data = JSON.parse(e.postData.contents);
       sheet.appendRow([
         data.id, data.timestamp, data.formatted_time, data.entry_type || "CHECK-IN", data.worker_name,
         data.worker_id, data.purpose, data.site_name, data.address || "", data.supervisor_name,
         data.supervisor_contact || "", data.latitude || "", data.longitude || "",
         data.accuracy || "", data.maps_url || "", data.photo_url || "", data.notes || ""
       ]);
       return ContentService.createTextOutput(JSON.stringify({status:"ok"})).setMimeType(ContentService.MimeType.JSON);
     } catch(err) {
       return ContentService.createTextOutput(JSON.stringify({status:"error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
4. Click the 💾 **Save** icon (or press `Cmd + S` / `Ctrl + S`).
5. Click **Deploy** → **New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️ *(CRITICAL: Google defaults to 'Only myself' which completely blocks webhooks!)*
6. Click **Deploy**, copy the resulting Web App URL (ends in `/exec`), and paste it into **Google Sheet Settings** in the app.
7. Click **Test Webhook Connection** and **Sync to Sheet** to upload all pending records!

> 💡 **Note on Updates**: Google Apps Script web apps are versioned snapshots. If you ever modify the script, you must click **Deploy** → **Manage deployments** → Edit ✏️ → Version: **New version** for changes to take effect.

---

### Option 2: Direct Google Cloud Service Account (No Webhooks)

If you prefer direct backend-to-Google communication via official Google Sheets API v4:
1. Create a Service Account in [Google Cloud Console](https://console.cloud.google.com/) and download the JSON key.
2. Share your Google Sheet (`126zQm54eFZyDvKWlUvi1efvorLNP5l_cfibAiespP6s`) with the Service Account email as **Editor**.
3. Place `credentials.json` into the attendance project folder (or paste the JSON in App Settings).
4. The server will automatically use Google Sheets API v4 to append rows in real time!

