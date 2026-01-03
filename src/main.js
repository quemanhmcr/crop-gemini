const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

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
});
