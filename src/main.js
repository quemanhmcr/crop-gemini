console.log("Script starting...");
let invoke, getCurrentWindow;

try {
  if (!window.__TAURI__) {
    throw new Error("window.__TAURI__ is undefined");
  }
  console.log("TAURI Object:", window.__TAURI__);

  invoke = window.__TAURI__.core.invoke;
  getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
} catch (e) {
  console.error("Initialization error:", e);
  alert("Initialization error: " + e.message);
}

// Snackbar notification system
let snackbar = null;
let snackbarTimeout = null;

function showSnackbar(message, type = '', action = null, duration = 6000) {
  if (!snackbar) {
    snackbar = document.getElementById('snackbar');
    if (!snackbar) {
      // Create snackbar if it doesn't exist
      snackbar = document.createElement('div');
      snackbar.id = 'snackbar';
      snackbar.className = 'snackbar';
      document.body.appendChild(snackbar);
    }
  }

  if (snackbarTimeout) clearTimeout(snackbarTimeout);

  snackbar.innerHTML = `<span>${message}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'snackbar-action';
    btn.textContent = action.label;
    btn.onclick = action.onClick;
    snackbar.appendChild(btn);
  }

  snackbar.className = 'snackbar show';
  if (type) snackbar.classList.add(type);

  // Don't auto-dismiss if there's an action button (user needs to interact)
  // Otherwise use the specified duration
  if (!action) {
    snackbarTimeout = setTimeout(() => {
      snackbar.classList.remove('show');
    }, duration);
  }
}

// Pending update state - tracks downloaded update ready to install on quit
let pendingUpdate = null;
let updateDownloading = false;

async function checkForAppUpdates() {
  console.log('[UPDATER] Starting update check...');
  try {
    // Check if auto-update is disabled
    const settings = await invoke('plugin:store|get', { key: 'settings', path: 'settings.json' }).catch(() => null);
    console.log('[UPDATER] Settings:', settings);
    if (settings && settings.autoUpdate === false) {
      console.log('[UPDATER] Auto-update disabled, skipping');
      return;
    }

    console.log('[UPDATER] Checking __TAURI_PLUGIN_UPDATER__:', window.__TAURI_PLUGIN_UPDATER__);
    if (!window.__TAURI_PLUGIN_UPDATER__) {
      console.error('[UPDATER] Updater plugin not available!');
      return;
    }

    const { check } = window.__TAURI_PLUGIN_UPDATER__;
    console.log('[UPDATER] Calling check()...');
    const update = await check();
    console.log('[UPDATER] Check result:', update);

    if (update) {
      console.log(`[UPDATER] Update available: ${update.version}`);
      showUpdateNotification(update);
    } else {
      console.log('[UPDATER] No update available or already on latest version');
    }
  } catch (error) {
    console.error('[UPDATER] Failed to check for updates:', error);
  }
}

async function showUpdateNotification(update) {
  try {
    const { WebviewWindow } = window.__TAURI__.window;

    // Create a small popup window for update notification
    const updateWin = new WebviewWindow('update-popup', {
      url: `data:text/html,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 20px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    h3 { margin-bottom: 10px; font-size: 16px; }
    p { font-size: 13px; color: #a0a0a0; margin-bottom: 20px; }
    .version { color: #4ade80; font-weight: bold; }
    .buttons { display: flex; gap: 10px; }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .primary {
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: white;
    }
    .primary:hover { transform: scale(1.05); }
    .secondary {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    .secondary:hover { background: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <h3>🎉 Có bản cập nhật mới!</h3>
  <p>Phiên bản <span class="version">${update.version}</span> đã sẵn sàng</p>
  <div class="buttons">
    <button class="primary" onclick="window.__TAURI__.event.emit('update-action', 'download')">Tải xuống</button>
    <button class="secondary" onclick="window.__TAURI__.event.emit('update-action', 'later')">Để sau</button>
  </div>
  <script>window.__TAURI__ = window.__TAURI__ || parent.__TAURI__;</script>
</body>
</html>
      `)}`,
      title: 'Cập nhật CropGemini',
      width: 320,
      height: 180,
      center: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true
    });

    // Listen for user action
    const { listen } = window.__TAURI__.event;
    const unlisten = await listen('update-action', async (event) => {
      if (event.payload === 'download') {
        // Close popup and start download
        const win = await updateWin;
        await win.close();
        await downloadUpdate(update);
      } else {
        // Just close popup
        const win = await updateWin;
        await win.close();
      }
      unlisten();
    });

    // Auto-close popup after 30 seconds if no action
    setTimeout(async () => {
      try {
        const win = await updateWin;
        await win.close();
        unlisten();
      } catch (e) { /* already closed */ }
    }, 30000);

  } catch (error) {
    console.error('[UPDATER] Failed to show update popup:', error);
    // Fallback to snackbar if popup fails
    showSnackbar(`Có phiên bản ${update.version} mới`, 'info', {
      label: 'Tải xuống',
      onClick: () => downloadUpdate(update)
    });
  }
}

async function downloadUpdate(update) {
  if (updateDownloading) return;

  try {
    updateDownloading = true;
    showSnackbar('Đang tải bản cập nhật...', 'info');

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0;
          console.log(`Download started, size: ${contentLength}`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const percent = Math.round((downloaded / contentLength) * 100);
            console.log(`Download progress: ${percent}%`);
          }
          break;
        case 'Finished':
          console.log('Download finished');
          break;
      }
    });

    // If we reach here, update was installed and app will restart
    // This is actually called BEFORE restart, so we can show a message
    showSnackbar('Đang cài đặt bản cập nhật...', 'success');

  } catch (error) {
    console.error('Update download failed:', error);
    showSnackbar('Lỗi tải cập nhật: ' + error, 'error');
    updateDownloading = false;
  }
}


// Open settings window
window.openSettings = openSettings;

async function openSettings() {
  try {
    const { WebviewWindow, getAllWindows } = window.__TAURI__.window;

    // Try to find existing settings window
    const allWindows = await getAllWindows();
    let settingsWin = allWindows.find(w => w.label === 'settings');

    if (settingsWin) {
      // Window exists, show and focus it
      await settingsWin.show();
      await settingsWin.setFocus();
    } else {
      // Create new settings window
      settingsWin = new WebviewWindow('settings', {
        url: 'settings.html',
        title: 'Cài đặt - CropGemini',
        width: 420,
        height: 580,
        center: true,
        decorations: false,
        alwaysOnTop: true,
        resizable: false
      });

      settingsWin.once('tauri://error', (e) => {
        console.error('Failed to create settings window:', e);
      });
    }
  } catch (e) {
    console.error('Failed to open settings:', e);
  }
}

let isSelecting = false;
let startX = 0;
let startY = 0;
let selectionBox = null;
let overlay = null;
let coordinates = null;

// Reset overlay state - call this every time window shows
function resetOverlay() {
  isSelecting = false;
  startX = 0;
  startY = 0;

  if (selectionBox) {
    selectionBox.classList.remove('visible');
    selectionBox.style.left = '0px';
    selectionBox.style.top = '0px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  }

  if (coordinates) {
    coordinates.classList.remove('visible');
    coordinates.textContent = '';
  }

  if (overlay) {
    overlay.classList.remove('selecting');
  }
}

async function hideWindow() {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (e) {
    console.error('Failed to hide window:', e);
  }
}

async function captureAndOpen(x, y, width, height) {
  try {
    // Hide window first to not capture the overlay
    await hideWindow();

    // Small delay to ensure window is hidden
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture the region
    const result = await invoke('capture_region', {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      scaleFactor: window.devicePixelRatio
    });

    console.log(result);
  } catch (error) {
    console.error('Capture failed:', error);
    alert('Capture failed: ' + error);
  }
}

function updateSelectionBox(e) {
  if (!isSelecting) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;

  // Update coordinates display
  coordinates.textContent = `${width} × ${height} px`;
}

function onMouseDown(e) {
  if (e.button !== 0) return; // Only left click

  // Don't start selection if clicking on settings button
  if (e.target.closest('#settings-btn')) return;

  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  selectionBox.classList.add('visible');
  coordinates.classList.add('visible');
  overlay.classList.add('selecting');

  selectionBox.style.left = `${startX}px`;
  selectionBox.style.top = `${startY}px`;
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
}

function onMouseMove(e) {
  updateSelectionBox(e);
}

async function onMouseUp(e) {
  if (!isSelecting) return;
  isSelecting = false;

  const endX = e.clientX;
  const endY = e.clientY;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // Minimum selection size
  if (width < 10 || height < 10) {
    resetOverlay();
    return;
  }

  // Capture the selected region
  await captureAndOpen(left, top, width, height);
}

async function onKeyDown(e) {
  if (e.key === 'Escape') {
    resetOverlay();
    await hideWindow();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  overlay = document.getElementById('overlay');
  selectionBox = document.getElementById('selection-box');
  coordinates = document.getElementById('coordinates');

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  // Listen for window focus/show events to reset state
  const appWindow = getCurrentWindow();
  await appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      resetOverlay();
    }
  });

  // Also reset on initial load
  resetOverlay();
  // Check for updates
  checkForAppUpdates();
});
